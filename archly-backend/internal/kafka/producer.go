package kafka

import (
	"encoding/json"
	"fmt"

	"github.com/IBM/sarama"
	"github.com/archly/api/internal/kafka/topics"
	"github.com/rs/zerolog/log"
)

// Topic constants — re-exported from topics sub-package for convenience.
const (
	TopicDesignPublished    = topics.DesignPublished
	TopicDesignForked       = topics.DesignForked
	TopicDesignViewed       = topics.DesignViewed
	TopicAIDiagramGenerated = topics.AIDiagramGenerated
	TopicRoomStateSaved     = topics.RoomStateSaved
)

// Producer is the interface satisfied by both the real Sarama producer
// and the no-op stub used when Kafka is unavailable.
type Producer interface {
	Publish(topic, key string, payload any) error
	Close() error
	IsNoop() bool
}

// ─── Real producer ────────────────────────────────────────────────────────

type saramaProducer struct {
	p sarama.SyncProducer
}

// NewProducer creates a synchronous Kafka producer.
func NewProducer(brokers []string) (Producer, error) {
	cfg := sarama.NewConfig()
	cfg.Producer.Return.Successes = true
	cfg.Producer.RequiredAcks = sarama.WaitForLocal
	cfg.Producer.Retry.Max = 3

	p, err := sarama.NewSyncProducer(brokers, cfg)
	if err != nil {
		return nil, fmt.Errorf("new kafka producer: %w", err)
	}
	return &saramaProducer{p: p}, nil
}

func (s *saramaProducer) Publish(topic, key string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}
	msg := &sarama.ProducerMessage{
		Topic: topic,
		Key:   sarama.StringEncoder(key),
		Value: sarama.ByteEncoder(body),
	}
	_, _, err = s.p.SendMessage(msg)
	if err != nil {
		log.Warn().Err(err).Str("topic", topic).Msg("kafka publish failed")
	}
	return err
}

func (s *saramaProducer) Close() error { return s.p.Close() }
func (s *saramaProducer) IsNoop() bool { return false }

// ─── No-op producer (dev fallback when Kafka is not running) ─────────────

type noopProducer struct{}

func NewNoopProducer() Producer { return &noopProducer{} }

func (n *noopProducer) Publish(topic, key string, payload any) error {
	log.Debug().Str("topic", topic).Str("key", key).Msg("kafka noop: event dropped")
	return nil
}
func (n *noopProducer) Close() error  { return nil }
func (n *noopProducer) IsNoop() bool  { return true }
