package ma.neurocare.config;

import java.util.concurrent.Executor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Pool dédié aux envois push (cahier §9.3) : un envoi lent ne bloque jamais les jobs du moteur de rappel.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    public static final String PUSH_EXECUTOR = "pushExecutor";

    @Bean(name = PUSH_EXECUTOR)
    Executor pushExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setThreadNamePrefix("push-");
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(8);
        executor.setQueueCapacity(1000);
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        executor.initialize();
        return executor;
    }
}
