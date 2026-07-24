// Package topics holds Kafka topic name constants shared by both
// the producer and consumer worker packages without creating import cycles.
package topics

const (
	DesignPublished    = "design.published"
	DesignForked       = "design.forked"
	DesignViewed       = "share.viewed"
	AIDiagramGenerated = "ai.diagram_generated"
	RoomStateSaved     = "room.state_saved"
)
