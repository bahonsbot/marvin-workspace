# Corrections Log

User corrections and feedback. Log when user explicitly corrects you.

## Format
## [CORR-YYYYMMDD-HHMM]

**Trigger:** "No, that's not right...", "Actually...", "You're wrong about...", etc.
**What was wrong:** [brief description]
**Lesson:** [what to remember going forward]

**Priority:** low | medium | high
**Status:** pending | promoted | resolved | wont_fix

---

## Recent Corrections
<!-- New entries go at top -->

## [CORR-20260315-1307]

**Trigger:** Morning Meeting protocol - I jumped to Self-Improvement without completing all Security Review findings
**What was wrong:** I presented Security Review HIGHs, then moved to Self-Improvement without going through MEDIUM and LOW findings. Philippe correctly caught this.
**Lesson:** Always complete ALL severity levels (HIGH → MEDIUM → LOW) in a report before moving to the next report category. The Morning Meeting protocol requires finishing each full report before proceeding.

**Priority:** medium
**Status:** resolved

## [CORR-20260312-2321]

**Trigger:** "if there is a 'good' option and a 'best' option when making a decision, generally go for the best option"
**What was clarified:** When presenting or choosing between a merely good option and a clearly better one, prefer the best option by default unless risk/cost/complexity makes that unreasonable or Philippe explicitly asks for the smaller/safer route
**Lesson:** Bias decisions toward the strongest architecture or solution, not just the adequate one, when the tradeoff is justified

**Priority:** high
**Status:** resolved

## [CORR-20260312-1442]

**Trigger:** "I actually do like the surprise MVPs, but perhaps not in the creative category..." and clarification that the first two trading goals are project-improvement goals while business analysis is a separate learning skill
**What was wrong:** I disabled surprise MVPs too broadly and was still blending trading-system improvement goals with business-analysis learning goals
**Lesson:** Allow surprise MVPs when they create useful systems or project improvements, but avoid creative-output surprise MVPs; split trading into project-improvement tracks (bots) versus staged learning tracks (business analysis)

**Priority:** high
**Status:** resolved

## [CORR-20260312-1425]

**Trigger:** "make sure to interpret the 'Learn Python programming' goal as a language skill approach, similarly as you would learn Japanese"
**What was wrong:** I was still treating Python mostly as artifact production instead of staged language learning: basics first, reading/comprehension first, then guided practice, then gradual progression
**Lesson:** Treat Python as a progressive language-learning track like Japanese: foundations, comprehension, guided exercises, then practical application only when matched to current level

**Priority:** high
**Status:** resolved

## [CORR-20260312-1356]

**Trigger:** "upon switching to the codex5.4 model, did you read its relevant prompting guidelines? I told you before"
**What was wrong:** After model switch to codex5.4, I did not reload `model-guidance/gpt-5.4.md` before continuing
**Lesson:** On every codex5.4 model switch, immediately read and apply `model-guidance/gpt-5.4.md` before answering further

**Priority:** high
**Status:** resolved

## [CORR-20260312-1300]

**Trigger:** "I told you before that we want to go through them one by one, step by step"
**What was wrong:** Morning Meeting — presented security findings in batch instead of one at a time
**Lesson:** Always present findings one at a time, wait for decision before proceeding to next

**Priority:** high
**Status:** resolved