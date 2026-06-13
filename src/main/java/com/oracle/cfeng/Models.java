package com.oracle.cfeng;

import java.time.LocalDateTime;

/** Small immutable DTOs used across the service and API layers. */
public final class Models {
    private Models() {}

    public record Project(long id, String name, String description,
                          String status, LocalDateTime createdAt) {}

    public record Signal(long id, long projectId, String category,
                         String controlName, boolean passed, int weight,
                         String detail, LocalDateTime observedAt) {}

    public record AuditEvent(long id, Long projectId, String eventType,
                             String actor, String message, LocalDateTime eventTime) {}

    public record Readiness(long projectId, String name, String status,
                            int readinessPct, int openGaps) {}
}
