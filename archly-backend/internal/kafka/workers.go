package kafka

import (
	"context"

	"github.com/IBM/sarama"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/archly/api/internal/kafka/topics"
	"github.com/archly/api/internal/kafka/workers"
)

func newConsumerGroup(brokers []string, groupID string) (sarama.ConsumerGroup, error) {
	cfg := sarama.NewConfig()
	cfg.Consumer.Group.Rebalance.GroupStrategies = []sarama.BalanceStrategy{sarama.NewBalanceStrategyRoundRobin()}
	cfg.Consumer.Offsets.Initial = sarama.OffsetNewest
	return sarama.NewConsumerGroup(brokers, groupID, cfg)
}

func StartAnalyticsWorker(ctx context.Context, brokers []string, pool *pgxpool.Pool) {
	t := []string{topics.DesignPublished, topics.DesignForked, topics.DesignViewed}
	runWorker(ctx, brokers, "archly-analytics", t, workers.NewAnalyticsConsumer(pool))
}

func StartRoomWorker(ctx context.Context, brokers []string, pool *pgxpool.Pool) {
	t := []string{topics.RoomStateSaved}
	runWorker(ctx, brokers, "archly-room", t, workers.NewRoomConsumer(pool))
}

func StartNotifyWorker(ctx context.Context, brokers []string, pool *pgxpool.Pool) {
	t := []string{topics.AIDiagramGenerated}
	runWorker(ctx, brokers, "archly-notify", t, workers.NewNotifyConsumer(pool))
}

func runWorker(ctx context.Context, brokers []string, groupID string, topics []string, handler sarama.ConsumerGroupHandler) {
	cg, err := newConsumerGroup(brokers, groupID)
	if err != nil {
		log.Warn().Err(err).Str("group", groupID).Msg("kafka consumer group unavailable")
		return
	}
	defer cg.Close()

	for {
		if err := cg.Consume(ctx, topics, handler); err != nil {
			log.Warn().Err(err).Str("group", groupID).Msg("consumer error")
		}
		if ctx.Err() != nil {
			return
		}
	}
}
