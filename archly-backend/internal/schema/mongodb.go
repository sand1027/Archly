package schema

import (
	"context"
	"fmt"
	"sort"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const (
	mongoSampleDocs       = 10
	mongoMaxCollections   = 80
	mongoPerCollectionTTL = 15 * time.Second
)

func introspectMongo(ctx context.Context, p *ParsedURL) (*Result, error) {
	clientOpts := options.Client().
		ApplyURI(p.DSN).
		SetConnectTimeout(20 * time.Second).
		SetServerSelectionTimeout(25 * time.Second).
		SetSocketTimeout(30 * time.Second)

	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		return nil, fmt.Errorf("connect mongodb: %w", err)
	}
	defer client.Disconnect(context.Background())

	pingCtx, pingCancel := context.WithTimeout(ctx, 25*time.Second)
	defer pingCancel()
	if err := client.Ping(pingCtx, nil); err != nil {
		return nil, fmt.Errorf("ping mongodb: %w", err)
	}

	db := client.Database(p.Database)
	listCtx, listCancel := context.WithTimeout(ctx, 20*time.Second)
	defer listCancel()

	collections, skippedViews, err := listMongoCollections(listCtx, db)
	if err != nil {
		return nil, err
	}
	sort.Strings(collections)

	var warnings []string
	if skippedViews > 0 {
		warnings = append(warnings, fmt.Sprintf("skipped %d MongoDB view(s)", skippedViews))
	}
	if len(collections) > mongoMaxCollections {
		warnings = append(warnings, fmt.Sprintf(
			"database has %d collections; importing first %d only",
			len(collections), mongoMaxCollections,
		))
		collections = collections[:mongoMaxCollections]
	}

	if len(collections) == 0 {
		return &Result{
			Driver:   DriverMongo,
			Schema:   p.Database,
			Database: p.Database,
			Warnings: warnings,
		}, nil
	}

	var tables []Table
	samples := make(map[string]*mongoCollSample, len(collections))

	for _, collName := range collections {
		collCtx, collCancel := context.WithTimeout(ctx, mongoPerCollectionTTL)
		sample, err := sampleMongoCollection(collCtx, db.Collection(collName))
		collCancel()

		if err != nil {
			warnings = append(warnings, fmt.Sprintf("collection %q: sampled with _id only (%v)", collName, err))
			sample = &mongoCollSample{
				columns:   []Column{{Name: "_id", Type: "objectId", PK: true}},
				oidFields: map[string][]primitive.ObjectID{},
			}
		}

		samples[collName] = sample
		tables = append(tables, Table{Name: collName, Columns: sample.columns})
	}

	fks := inferMongoFKs(collections, samples)
	applyMongoFKs(tables, fks)

	return &Result{
		Driver:   DriverMongo,
		Schema:   p.Database,
		Database: p.Database,
		Tables:   tables,
		FKs:      fks,
		Warnings: warnings,
	}, nil
}

func sampleMongoCollection(ctx context.Context, coll *mongo.Collection) (*mongoCollSample, error) {
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$sample", Value: bson.D{{Key: "size", Value: mongoSampleDocs}}}},
	}
	cur, err := coll.Aggregate(ctx, pipeline)
	if err != nil {
		cur, err = coll.Find(ctx, bson.M{}, options.Find().SetLimit(mongoSampleDocs))
		if err != nil {
			return nil, err
		}
	}
	defer cur.Close(ctx)

	type fieldStat struct {
		types    map[string]int
		nullable bool
	}

	stats := map[string]*fieldStat{}
	hasID := false
	var docIDs []primitive.ObjectID
	oidFields := map[string][]primitive.ObjectID{}

	for cur.Next(ctx) {
		var doc bson.M
		if err := cur.Decode(&doc); err != nil {
			continue
		}

		flat := map[string]any{}
		for k, v := range doc {
			flat[k] = v
		}
		docID, fieldIDs := collectDocObjectIDs(flat)
		if docID != primitive.NilObjectID {
			docIDs = append(docIDs, docID)
		} else if raw, ok := doc["_id"]; ok {
			if ids := extractObjectIDs(raw); len(ids) > 0 {
				docIDs = append(docIDs, ids[0])
			}
		}
		mergeFieldIDs(oidFields, fieldIDs)

		for k, v := range doc {
			if k == "_id" {
				hasID = true
			}
			if stats[k] == nil {
				stats[k] = &fieldStat{types: map[string]int{}}
			}
			if v == nil {
				stats[k].nullable = true
				continue
			}
			stats[k].types[mongoTypeOf(v)]++
		}
	}
	if err := cur.Err(); err != nil {
		return nil, err
	}

	if len(stats) == 0 {
		return &mongoCollSample{
			columns:   []Column{{Name: "_id", Type: "objectId", PK: true}},
			docIDs:    docIDs,
			oidFields: oidFields,
		}, nil
	}

	names := make([]string, 0, len(stats))
	for n := range stats {
		names = append(names, n)
	}
	sort.Strings(names)

	cols := make([]Column, 0, len(names))
	for _, name := range names {
		st := stats[name]
		cols = append(cols, Column{
			Name:     name,
			Type:     dominantType(st.types),
			Nullable: st.nullable,
			PK:       name == "_id",
		})
	}

	if !hasID {
		cols = append([]Column{{Name: "_id", Type: "objectId", PK: true}}, cols...)
	}

	return &mongoCollSample{
		columns:   cols,
		docIDs:    docIDs,
		oidFields: oidFields,
	}, nil
}

func mongoTypeOf(v any) string {
	switch v.(type) {
	case string:
		return "text"
	case bool:
		return "bool"
	case int32, int64, int:
		return "int"
	case float32, float64:
		return "float"
	case primitive.ObjectID:
		return "objectId"
	case primitive.DateTime:
		return "timestamptz"
	case primitive.A:
		return "array"
	case bson.M, bson.D, map[string]any:
		return "object"
	default:
		return "mixed"
	}
}

func dominantType(counts map[string]int) string {
	best, score := "mixed", 0
	for t, n := range counts {
		if n > score {
			best, score = t, n
		}
	}
	return best
}
