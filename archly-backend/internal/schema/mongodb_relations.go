package schema

import (
	"sort"
	"strings"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

const (
	mongoMinIDMatches     = 2
	mongoFieldOverlapMin  = 0.45
	mongoSharedIDOverlap  = 0.35
	mongoNameMatchOverlap = 0.15 // name hint + weak overlap still links
)

type mongoCollSample struct {
	columns   []Column
	docIDs    []primitive.ObjectID
	oidFields map[string][]primitive.ObjectID
}

func inferMongoFKs(collections []string, samples map[string]*mongoCollSample) []ForeignKey {
	idSets := make(map[string]map[primitive.ObjectID]struct{}, len(collections))
	for _, name := range collections {
		idSets[name] = oidSet(samples[name].docIDs)
	}

	var fks []ForeignKey
	seen := map[string]bool{}

	addFK := func(fk ForeignKey) {
		key := fk.ChildTable + "|" + fk.ChildColumn + "|" + fk.ParentTable
		if seen[key] {
			return
		}
		seen[key] = true
		fks = append(fks, fk)
	}

	// Shared _id: patients._id == users._id (same identity across collections).
	for i, a := range collections {
		for _, b := range collections[i+1:] {
			ratio := overlapRatio(samples[a].docIDs, samples[b].docIDs)
			if ratio < mongoSharedIDOverlap {
				continue
			}
			parent, child := pickSharedIDParent(a, b)
			addFK(ForeignKey{
				ChildTable:   child,
				ChildColumn:  "_id",
				ParentTable:  parent,
				ParentColumn: "_id",
			})
		}
	}

	collSet := map[string]bool{}
	for _, c := range collections {
		collSet[strings.ToLower(c)] = true
	}

	for _, child := range collections {
		sample := samples[child]
		for field, values := range sample.oidFields {
			if field == "_id" || len(values) == 0 {
				continue
			}

			bestParent := ""
			bestScore := 0.0

			for _, parent := range collections {
				if parent == child {
					continue
				}
				ratio := overlapRatio(values, samples[parent].docIDs)
				score := ratio
				if nameHintsParent(field, parent) {
					score += 0.25
				}
				if score > bestScore {
					bestScore = score
					bestParent = parent
				}
			}

			threshold := mongoFieldOverlapMin
			if bestParent != "" && nameHintsParent(field, bestParent) {
				threshold = mongoNameMatchOverlap
			}

			if bestParent != "" && bestScore >= threshold && countOverlap(values, idSets[bestParent]) >= mongoMinIDMatches {
				addFK(ForeignKey{
					ChildTable:   child,
					ChildColumn:  field,
					ParentTable:  bestParent,
					ParentColumn: "_id",
				})
				continue
			}

			// Name-only fallback for objectId fields (userId, user, createdBy, …).
			if ref := guessMongoRef(field, collections, collSet); ref != "" && ref != child {
				addFK(ForeignKey{
					ChildTable:   child,
					ChildColumn:  field,
					ParentTable:  ref,
					ParentColumn: "_id",
				})
			}
		}
	}

	return fks
}

func applyMongoFKs(tables []Table, fks []ForeignKey) {
	fkByChildCol := map[string]map[string]ForeignKey{}
	for _, fk := range fks {
		if fkByChildCol[fk.ChildTable] == nil {
			fkByChildCol[fk.ChildTable] = map[string]ForeignKey{}
		}
		fkByChildCol[fk.ChildTable][fk.ChildColumn] = fk
	}

	for i := range tables {
		fkMap := fkByChildCol[tables[i].Name]
		if fkMap == nil {
			continue
		}
		for j := range tables[i].Columns {
			col := tables[i].Columns[j].Name
			if fk, ok := fkMap[col]; ok {
				tables[i].Columns[j].FK = &FKJSON{Table: fk.ParentTable, Column: fk.ParentColumn}
			}
		}
	}
}

func oidSet(ids []primitive.ObjectID) map[primitive.ObjectID]struct{} {
	set := make(map[primitive.ObjectID]struct{}, len(ids))
	for _, id := range ids {
		set[id] = struct{}{}
	}
	return set
}

func overlapRatio(a, b []primitive.ObjectID) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	setB := oidSet(b)
	seen := map[primitive.ObjectID]struct{}{}
	matches := 0
	for _, id := range a {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		if _, ok := setB[id]; ok {
			matches++
		}
	}
	if len(seen) == 0 {
		return 0
	}
	return float64(matches) / float64(len(seen))
}

func countOverlap(a []primitive.ObjectID, setB map[primitive.ObjectID]struct{}) int {
	seen := map[primitive.ObjectID]struct{}{}
	n := 0
	for _, id := range a {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		if _, ok := setB[id]; ok {
			n++
		}
	}
	return n
}

func pickSharedIDParent(a, b string) (parent, child string) {
	pa, pb := mongoParentPriority(a), mongoParentPriority(b)
	switch {
	case pa > pb:
		return a, b
	case pb > pa:
		return b, a
	default:
		// Stable tie-break: shorter name as parent (users before patients).
		if len(a) <= len(b) {
			return a, b
		}
		return b, a
	}
}

func mongoParentPriority(name string) int {
	lower := strings.ToLower(name)
	switch lower {
	case "users", "user":
		return 100
	case "accounts", "account":
		return 90
	case "profiles", "profile":
		return 80
	case "organizations", "organisation", "org", "orgs":
		return 70
	default:
		return 10
	}
}

func nameHintsParent(field, parent string) bool {
	field = strings.ToLower(field)
	parent = strings.ToLower(parent)

	base := field
	base = strings.TrimSuffix(base, "_id")
	base = strings.TrimSuffix(base, "id")
	base = strings.TrimSuffix(base, "_")
	base = strings.TrimSpace(base)
	if base == "" {
		return false
	}

	parentSingular := strings.TrimSuffix(parent, "s")
	parentSingular = strings.TrimSuffix(parentSingular, "es")

	candidates := []string{
		parent,
		parentSingular,
		strings.TrimSuffix(parent, "s"),
	}
	for _, c := range candidates {
		if c == "" {
			continue
		}
		if base == c || strings.HasPrefix(base, c) || strings.HasSuffix(base, c) {
			return true
		}
	}
	return strings.Contains(parent, base) || strings.Contains(base, parentSingular)
}

func extractObjectIDs(v any) []primitive.ObjectID {
	switch x := v.(type) {
	case primitive.ObjectID:
		return []primitive.ObjectID{x}
	case string:
		if len(x) == 24 {
			if oid, err := primitive.ObjectIDFromHex(x); err == nil {
				return []primitive.ObjectID{oid}
			}
		}
	case primitive.A:
		var ids []primitive.ObjectID
		for _, item := range x {
			ids = append(ids, extractObjectIDs(item)...)
		}
		return ids
	}
	return nil
}

func collectDocObjectIDs(doc map[string]any) (docID primitive.ObjectID, fields map[string][]primitive.ObjectID) {
	fields = map[string][]primitive.ObjectID{}

	if raw, ok := doc["_id"]; ok {
		if ids := extractObjectIDs(raw); len(ids) > 0 {
			docID = ids[0]
		}
	}

	for k, v := range doc {
		if k == "_id" {
			continue
		}
		if ids := extractObjectIDs(v); len(ids) > 0 {
			fields[k] = append(fields[k], ids...)
		}
	}

	return docID, fields
}

func mergeFieldIDs(dst map[string][]primitive.ObjectID, src map[string][]primitive.ObjectID) {
	for k, ids := range src {
		dst[k] = append(dst[k], ids...)
	}
}

func guessMongoRef(field string, collections []string, collSet map[string]bool) string {
	lower := strings.ToLower(field)
	if lower == "_id" {
		return ""
	}

	bases := refNameBases(field)
	if len(bases) == 0 {
		return ""
	}

	for _, base := range bases {
		if ref := matchCollectionName(base, collections, collSet); ref != "" {
			return ref
		}
	}
	return ""
}

func refNameBases(field string) []string {
	lower := strings.ToLower(field)
	trimmed := field

	for _, suffix := range []string{"_id", "Id", "ID", "_ref", "Ref"} {
		if strings.HasSuffix(trimmed, suffix) {
			trimmed = strings.TrimSuffix(trimmed, suffix)
			break
		}
	}
	trimmed = strings.TrimSpace(trimmed)
	if trimmed == "" {
		return nil
	}

	bases := []string{strings.ToLower(trimmed)}
	if lower != bases[0] {
		bases = append(bases, lower)
	}

	// createdBy / updatedBy → users
	if strings.HasSuffix(strings.ToLower(trimmed), "by") && len(trimmed) > 2 {
		bases = append(bases, "user")
	}

	seen := map[string]bool{}
	var out []string
	for _, b := range bases {
		if b != "" && !seen[b] {
			seen[b] = true
			out = append(out, b)
		}
	}
	sort.Strings(out)
	return out
}

func matchCollectionName(base string, collections []string, collSet map[string]bool) string {
	candidates := []string{
		base,
		base + "s",
		base + "es",
	}
	if strings.HasSuffix(base, "y") && len(base) > 1 {
		candidates = append(candidates, base[:len(base)-1]+"ies")
	}
	if strings.HasSuffix(base, "s") && len(base) > 1 {
		candidates = append(candidates, base[:len(base)-1])
	}

	for _, c := range candidates {
		if collSet[c] {
			for _, orig := range collections {
				if strings.EqualFold(orig, c) {
					return orig
				}
			}
		}
	}

	for _, coll := range collections {
		cl := strings.ToLower(coll)
		if cl == base || strings.HasPrefix(cl, base) || strings.HasSuffix(cl, base) {
			return coll
		}
	}
	return ""
}
