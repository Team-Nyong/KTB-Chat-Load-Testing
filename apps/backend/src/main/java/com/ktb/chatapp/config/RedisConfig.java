package com.ktb.chatapp.config;

import java.util.Arrays;
import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

/**
 * Redisson 클라이언트를 전역에서 재사용하기 위한 설정.
 * 세션 저장소, Socket.IO 등 Redis 의존 컴포넌트가 모두 이 빈을 주입받는다.
 */
@Configuration
public class RedisConfig {

    @Value("${spring.data.redis.host:localhost}")
    private String sessionRedisHost;

    @Value("${spring.data.redis.port:6379}")
    private Integer sessionRedisPort;

    @Value("${spring.data.redis.password:}")
    private String sessionRedisPassword;

    @Value("${spring.data.redis.database:0}")
    private Integer sessionRedisDatabase;

    @Value("${socketio.redis.host:${spring.data.redis.host:localhost}}")
    private String socketIoRedisHost;

    @Value("${socketio.redis.port:${spring.data.redis.port:6379}}")
    private Integer socketIoRedisPort;

    @Value("${socketio.redis.password:}")
    private String socketIoRedisPassword;

    @Value("${socketio.redis.database:1}")
    private Integer socketIoRedisDatabase;

    @Value("${socketio.redis.cluster-nodes:}")
    private String socketIoRedisClusterNodes;

    @Bean(name = "sessionRedisClient", destroyMethod = "shutdown")
    public RedissonClient sessionRedissonClient() {
        return createSingleServerClient(
                sessionRedisHost, sessionRedisPort, sessionRedisPassword, sessionRedisDatabase);
    }

    @Bean(name = "socketIoRedisClient", destroyMethod = "shutdown")
    public RedissonClient socketIoRedissonClient() {
        if (StringUtils.hasText(socketIoRedisClusterNodes)) {
            return createClusterClient(socketIoRedisClusterNodes, socketIoRedisPassword);
        }
        return createSingleServerClient(
                socketIoRedisHost, socketIoRedisPort, socketIoRedisPassword, socketIoRedisDatabase);
    }

    private RedissonClient createSingleServerClient(String host, Integer port, String password, Integer database) {
        Config config = new Config();
        var singleServerConfig = config.useSingleServer()
                .setAddress(String.format("redis://%s:%d", host, port))
                .setDatabase(database);

        if (StringUtils.hasText(password)) {
            singleServerConfig.setPassword(password);
        }

        return Redisson.create(config);
    }

    private RedissonClient createClusterClient(String clusterNodes, String password) {
        Config config = new Config();
        var clusterConfig = config.useClusterServers();

        Arrays.stream(clusterNodes.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .map(this::normalizeRedisAddress)
                .forEach(clusterConfig::addNodeAddress);

        if (clusterConfig.getNodeAddresses().isEmpty()) {
            throw new IllegalArgumentException("socketio.redis.cluster-nodes must contain at least one address");
        }

        if (StringUtils.hasText(password)) {
            clusterConfig.setPassword(password);
        }

        return Redisson.create(config);
    }

    private String normalizeRedisAddress(String address) {
        if (address.startsWith("redis://") || address.startsWith("rediss://")) {
            return address;
        }
        return "redis://" + address;
    }
}
