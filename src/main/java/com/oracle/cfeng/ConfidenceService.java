package com.oracle.cfeng;

import com.oracle.cfeng.Models.AuditEvent;
import com.oracle.cfeng.Models.Project;
import com.oracle.cfeng.Models.Readiness;
import com.oracle.cfeng.Models.Signal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ConfidenceService {

    private final JdbcTemplate jdbc;

    @Value("${app.ai-profile}")
    private String aiProfile;

    @Value("${app.promote-threshold}")
    private int promoteThreshold;

    public ConfidenceService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ---- row mappers --------------------------------------------------

    private static final RowMapper<Project> PROJECT = (rs, i) -> new Project(
            rs.getLong("id"), rs.getString("name"), rs.getString("description"),
            rs.getString("status"), rs.getTimestamp("created_at").toLocalDateTime());

    private static final RowMapper<Signal> SIGNAL = (rs, i) -> new Signal(
            rs.getLong("id"), rs.getLong("project_id"), rs.getString("category"),
            rs.getString("control_name"), rs.getInt("passed") == 1,
            rs.getInt("weight"), rs.getString("detail"),
            rs.getTimestamp("observed_at").toLocalDateTime());

    private static final RowMapper<AuditEvent> AUDIT = (rs, i) -> new AuditEvent(
            rs.getLong("id"), rs.getObject("project_id", Long.class),
            rs.getString("event_type"), rs.getString("actor"),
            rs.getString("message"), rs.getTimestamp("event_time").toLocalDateTime());

    private static final RowMapper<Readiness> READINESS = (rs, i) -> new Readiness(
            rs.getLong("project_id"), rs.getString("name"), rs.getString("status"),
            rs.getInt("readiness_pct"), rs.getInt("open_gaps"));

    // ---- reads --------------------------------------------------------

    public Project getProject(long id) {
        return jdbc.queryForObject(
                "SELECT id, name, description, status, created_at FROM projects WHERE id = ?",
                PROJECT, id);
    }

    public Readiness getReadiness(long id) {
        return jdbc.queryForObject(
                "SELECT project_id, name, status, readiness_pct, open_gaps FROM v_readiness WHERE project_id = ?",
                READINESS, id);
    }

    public List<Signal> getSignals(long id) {
        return jdbc.query(
                "SELECT id, project_id, category, control_name, passed, weight, detail, observed_at "
                        + "FROM signals WHERE project_id = ? ORDER BY id",
                SIGNAL, id);
    }

    public List<AuditEvent> getAudit(long id) {
        return jdbc.query(
                "SELECT id, project_id, event_type, actor, message, event_time "
                        + "FROM audit_events WHERE project_id = ? ORDER BY id DESC",
                AUDIT, id);
    }

    // ---- mutations ----------------------------------------------------

    /** Remediate one blocking control. The responsible path to readiness. */
    @Transactional
    public void resolveSignal(long projectId, long signalId) {
        String control = jdbc.queryForObject(
                "SELECT control_name FROM signals WHERE id = ? AND project_id = ?",
                String.class, signalId, projectId);
        jdbc.update("UPDATE signals SET passed = 1, observed_at = SYSTIMESTAMP "
                + "WHERE id = ? AND project_id = ?", signalId, projectId);
        logAudit(projectId, "SIGNAL_UPDATE", "Resolved: " + control);
    }

    /**
     * Promote to production. If readiness is below the threshold this is an
     * override ("out of sheer confidence"): we still promote, but we ask the
     * Autonomous Database, via Select AI, to put the risk on the record.
     */
    @Transactional
    public Map<String, Object> promote(long projectId) {
        Readiness r = getReadiness(projectId);
        boolean override = r.readinessPct() < promoteThreshold;

        jdbc.update("UPDATE projects SET status = 'PRODUCTION' WHERE id = ?", projectId);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("override", override);

        if (override) {
            logAudit(projectId, "PROMOTE", "Promoted POC to PRODUCTION at " + r.readinessPct()
                    + "% (below " + promoteThreshold + "% threshold) out of sheer confidence");
            String risk = riskAssessment(projectId);
            logAudit(projectId, "AI_RISK", "Select AI flagged the override and its consequences");
            out.put("risk", risk);
        } else {
            logAudit(projectId, "LAUNCH", "Promoted to PRODUCTION at " + r.readinessPct()
                    + "% - all controls green");
            out.put("risk", null);
        }
        out.put("readiness", getReadiness(projectId));
        return out;
    }

    @Transactional
    public void rollback(long projectId) {
        jdbc.update("UPDATE projects SET status = 'POC' WHERE id = ?", projectId);
        logAudit(projectId, "ROLLBACK", "Rolled back to POC; remediation required");
    }

    // ---- Select AI ----------------------------------------------------

    /** Hint: what is blocking production. Uses the stateless GENERATE form. */
    public String hint(long projectId) {
        Project p = getProject(projectId);
        String prompt = "List the failing controls for the project named " + p.name()
                + " and give one concrete remediation for each before it can go to "
                + "production. Be concise and use a numbered list.";
        String answer = generate(prompt);
        logAudit(projectId, "AI_HINT", "Asked Autonomous Database for a hint");
        return answer;
    }

    /** Risk narration for an override promotion. */
    public String riskAssessment(long projectId) {
        Project p = getProject(projectId);
        String prompt = "The project named " + p.name() + " was just promoted to production "
                + "while some controls are still failing. Assess the risk of running in "
                + "production with those specific open controls, and recommend whether to "
                + "roll back. Be concise.";
        return generate(prompt);
    }

    private String generate(String prompt) {
        String answer = jdbc.queryForObject(
                "SELECT DBMS_CLOUD_AI.GENERATE(prompt => ?, profile_name => ?, action => 'narrate') FROM dual",
                String.class, prompt, aiProfile);
        return (answer == null || answer.isBlank()) ? "No response from Select AI." : answer;
    }

    public void logAudit(long projectId, String type, String message) {
        jdbc.update("INSERT INTO audit_events (project_id, event_type, actor, message) "
                + "VALUES (?, ?, 'system', ?)", projectId, type, message);
    }
}
