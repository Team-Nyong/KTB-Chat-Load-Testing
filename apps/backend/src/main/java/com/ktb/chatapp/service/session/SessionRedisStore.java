package com.ktb.chatapp.service.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.ktb.chatapp.model.Session;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.redisson.codec.JsonJacksonCodec;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import static com.ktb.chatapp.model.Session.SESSION_TTL;

/**
 * Redis 기반 세션 스토리지.
 * 사용자당 하나의 세션 버킷을 유지하고 TTL로 만료를 관리한다.
 */
@Slf4j
@Primary
@Component
public class SessionRedisStore implements SessionStore {

    private static final String SESSION_KEY_PREFIX = "chatapp:session:user:";
    private final RedissonClient redissonClient;
    private final JsonJacksonCodec sessionCodec;
    private final long sessionTtlSeconds;

    public SessionRedisStore(@Qualifier("sessionRedisClient") RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
        this.sessionCodec = new JsonJacksonCodec(createObjectMapper());
        this.sessionTtlSeconds = DurationStyle.detectAndParse(SESSION_TTL).getSeconds();
    }

    @Override
    public Optional<Session> findByUserId(String userId) {
        if (userId == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(getBucket(userId).get());
    }

    @Override
    public Session save(Session session) {
        if (session == null || session.getUserId() == null) {
            throw new IllegalArgumentException("세션 또는 사용자 ID가 null 입니다.");
        }
        RBucket<Session> bucket = getBucket(session.getUserId());
        bucket.set(session, sessionTtlSeconds, TimeUnit.SECONDS);
        return session;
    }

    @Override
    public void deleteAll(String userId) {
        if (userId == null) {
            return;
        }
        getBucket(userId).delete();
    }

    @Override
    public void delete(String userId, String sessionId) {
        if (userId == null) {
            return;
        }
        RBucket<Session> bucket = getBucket(userId);
        Session existing = bucket.get();
        if (existing != null && (sessionId == null || sessionId.equals(existing.getSessionId()))) {
            bucket.delete();
        }
    }

    private RBucket<Session> getBucket(String userId) {
        return redissonClient.getBucket(SESSION_KEY_PREFIX + userId, sessionCodec);
    }

    private static ObjectMapper createObjectMapper() {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        return mapper;
    }
}
