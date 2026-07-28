package schema

import (
	"testing"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func TestOverlapRatio_sharedIDs(t *testing.T) {
	id1 := primitive.NewObjectID()
	id2 := primitive.NewObjectID()
	id3 := primitive.NewObjectID()

	a := []primitive.ObjectID{id1, id2, id3}
	b := []primitive.ObjectID{id1, id2, primitive.NewObjectID()}

	r := overlapRatio(a, b)
	if r < 0.6 {
		t.Fatalf("expected high overlap, got %v", r)
	}
}

func TestInferMongoFKs_sharedID_usersPatients(t *testing.T) {
	shared1 := primitive.NewObjectID()
	shared2 := primitive.NewObjectID()

	samples := map[string]*mongoCollSample{
		"users": {
			columns: []Column{{Name: "_id", Type: "objectId", PK: true}},
			docIDs:  []primitive.ObjectID{shared1, shared2},
		},
		"patients": {
			columns: []Column{{Name: "_id", Type: "objectId", PK: true}},
			docIDs:  []primitive.ObjectID{shared1, shared2},
		},
	}

	fks := inferMongoFKs([]string{"users", "patients"}, samples)
	if len(fks) != 1 {
		t.Fatalf("expected 1 shared-id FK, got %d: %+v", len(fks), fks)
	}
	if fks[0].ParentTable != "users" || fks[0].ChildTable != "patients" || fks[0].ChildColumn != "_id" {
		t.Fatalf("unexpected FK: %+v", fks[0])
	}
}

func TestInferMongoFKs_fieldValueMatch(t *testing.T) {
	userID := primitive.NewObjectID()
	otherID := primitive.NewObjectID()

	samples := map[string]*mongoCollSample{
		"users": {
			columns: []Column{{Name: "_id", Type: "objectId", PK: true}},
			docIDs:  []primitive.ObjectID{userID, otherID},
		},
		"appointments": {
			columns: []Column{
				{Name: "_id", Type: "objectId", PK: true},
				{Name: "owner", Type: "objectId"},
			},
			docIDs: []primitive.ObjectID{primitive.NewObjectID(), primitive.NewObjectID()},
			oidFields: map[string][]primitive.ObjectID{
				"owner": {userID, otherID},
			},
		},
	}

	fks := inferMongoFKs([]string{"users", "appointments"}, samples)
	found := false
	for _, fk := range fks {
		if fk.ChildTable == "appointments" && fk.ChildColumn == "owner" && fk.ParentTable == "users" {
			found = true
		}
	}
	if !found {
		t.Fatalf("expected owner -> users FK, got %+v", fks)
	}
}

func TestGuessMongoRef_createdBy(t *testing.T) {
	colls := []string{"users", "patients"}
	set := map[string]bool{"users": true, "patients": true}
	if ref := guessMongoRef("createdBy", colls, set); ref != "users" {
		t.Fatalf("expected users, got %q", ref)
	}
}

func TestPickSharedIDParent_usersOverPatients(t *testing.T) {
	p, c := pickSharedIDParent("patients", "users")
	if p != "users" || c != "patients" {
		t.Fatalf("expected users->patients, got %s->%s", p, c)
	}
}
