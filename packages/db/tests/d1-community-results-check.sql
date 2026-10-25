CREATE TABLE community_results_ci_assert(ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO community_results_ci_assert SELECT CASE WHEN COUNT(*)=1 THEN 1 ELSE 0 END FROM sqlite_master WHERE type='index' AND name='attempts_version_user_submitted_idx';
