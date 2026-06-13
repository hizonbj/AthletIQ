package com.oracle.cfeng;

import com.oracle.cfeng.Models.Signal;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {

    private final ConfidenceService svc;

    public ApiController(ConfidenceService svc) {
        this.svc = svc;
    }

    /** Full dashboard payload for one project. */
    @GetMapping("/projects/{id}")
    public Map<String, Object> project(@PathVariable long id) {
        List<Signal> signals = svc.getSignals(id);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("project", svc.getProject(id));
        out.put("readiness", svc.getReadiness(id));
        out.put("signals", signals);
        out.put("categories", summarize(signals));
        return out;
    }

    /** Remediate one blocking control, then return the refreshed dashboard. */
    @PostMapping("/projects/{id}/signals/{sid}/resolve")
    public Map<String, Object> resolve(@PathVariable long id, @PathVariable long sid) {
        svc.resolveSignal(id, sid);
        return project(id);
    }

    @PostMapping("/projects/{id}/hint")
    public Map<String, String> hint(@PathVariable long id) {
        return Map.of("hint", svc.hint(id));
    }

    /** Promote. Returns {override, risk, readiness}. */
    @PostMapping("/projects/{id}/promote")
    public Map<String, Object> promote(@PathVariable long id) {
        return svc.promote(id);
    }

    @PostMapping("/projects/{id}/rollback")
    public Map<String, Object> rollback(@PathVariable long id) {
        svc.rollback(id);
        return project(id);
    }

    @GetMapping("/projects/{id}/audit")
    public Object audit(@PathVariable long id) {
        return svc.getAudit(id);
    }

    private List<Map<String, Object>> summarize(List<Signal> signals) {
        Map<String, int[]> agg = new LinkedHashMap<>();
        for (Signal s : signals) {
            int[] pt = agg.computeIfAbsent(s.category(), k -> new int[2]);
            if (s.passed()) pt[0]++;
            pt[1]++;
        }
        return agg.entrySet().stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("category", e.getKey());
            m.put("passed", e.getValue()[0]);
            m.put("total", e.getValue()[1]);
            return m;
        }).toList();
    }
}
