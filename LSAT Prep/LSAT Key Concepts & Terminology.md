---
tags: [lsat, concepts, terminology, logic]
related: "[[LSAT Prep Hub]], [[LR - Conditional Logic]], [[LR - Question Types]]"
created: 2026-06-06
---

# LSAT Key Concepts & Terminology

> A reference guide for foundational LSAT logic concepts — definitions, explanations, examples, and LSAT-specific usage notes.
> Back to [[LSAT Prep Hub]]

---

## 1. Conditional Logic (If/Then)

The backbone of LSAT logical reasoning. Mastering this is non-negotiable.

### Structure
A conditional statement takes the form: **If A, then B** — written as **A → B**

- **A** = the sufficient condition (triggers the result)
- **B** = the necessary condition (what must follow)

### The Four Forms

| Form | Structure | Valid? |
|------|-----------|--------|
| Original | A → B | ✅ Yes |
| Contrapositive | ~B → ~A | ✅ Yes — always valid |
| Mistaken Reversal | B → A | ❌ Never valid |
| Mistaken Negation | ~A → ~B | ❌ Never valid |

### Example
> "If it rains, the ground gets wet." (Rain → Wet ground)

- ✅ It rained → ground is wet (original)
- ✅ Ground is NOT wet → it did NOT rain (contrapositive)
- ❌ Ground is wet → it rained (mistaken reversal — could be a sprinkler)
- ❌ It did NOT rain → ground is NOT wet (mistaken negation — again, sprinkler)

### LSAT Application
The LSAT frequently presents mistaken reversals and negations as answer choices to trap you. Always ask: "Does the conclusion actually follow from the premises, or is this a reversal/negation?"

---

## 2. Sufficient vs. Necessary Conditions

Closely tied to conditional logic — one of the most tested distinctions on the entire exam.

### Sufficient Condition
**Definition:** If X is sufficient for Y, then X alone guarantees Y. Whenever X is present, Y must follow.

- X is enough to produce Y
- Does NOT mean X is the only way to get Y
- Signal words: **"if," "when," "whenever," "all," "every," "anyone who"**

**Example:** "If you score 173 on the LSAT, you will get into Columbia."
- Scoring 173 is sufficient → guaranteed admission
- Does NOT mean 173 is the only way in

### Necessary Condition
**Definition:** If Y is necessary for X, then X cannot happen without Y. Y must be present for X to occur.

- Y is required — but not necessarily enough on its own
- Signal words: **"only if," "must," "required," "necessary," "unless," "without"**

**Example:** "You must pass the bar to practice law."
- Passing the bar is necessary → can't practice without it
- Does NOT mean everyone who passes the bar practices law

### The Critical Trap
**"Only"** is the most dangerous word on the LSAT.
- "Only lawyers can argue in court" → Being a lawyer is **necessary** to argue, NOT sufficient
- People instinctively read "only" as sufficient — the LSAT exploits this constantly

### Quick Memory Tool
- **Sufficient = IF** (guarantees the result)
- **Necessary = ONLY IF** (required for the result)

---

## 3. Quantifier Logic

How the LSAT uses words like "some," "most," and "all" — these have precise mathematical definitions, NOT their everyday meanings.

### The Quantifier Scale

| Term | LSAT Definition | Real Percentage | Notes |
|------|----------------|-----------------|-------|
| **All / Every / Each / Any** | 100% — no exceptions | 100% | Creates a conditional: All A → B means A → B |
| **No / None** | 0% — complete exclusion | 0% | "No A are B" means A → ~B |
| **Most** | More than half | 51–99% | Hard mathematical definition — NOT vague |
| **Many** | A large but unspecified number | Vague | Less precise than "most" — no exact % |
| **Some** | At least one | 1–100% | The LSAT's most exploited quantifier — just one is enough |
| **Few** | A small number | Small but ≥1 | Not zero — still at least one |

### The Most Important Rules

**"Some A are B" does NOT mean "Some B are A"**
Actually in this specific case it does — "some" is symmetric. But this intuition fails with "most."

**"Most A are B" does NOT mean "Most B are A"**
Most dogs are mammals ≠ most mammals are dogs. (Most mammals are not dogs.)

**"All A are B" DOES allow you to infer "Some B are A"**
If all lawyers passed the bar, then some bar passers are lawyers.

**"Some" + "Some" tells you nothing**
Some lawyers are tall. Some tall people are athletes. You CANNOT conclude that some lawyers are athletes. The LSAT loves this trap.

**"Most" + "Most" = "Some"**
Most A are B. Most A are C. You CAN conclude some B are C — because both groups are over 50% of A, they must overlap.

### LSAT Application
Quantifiers show up most in **Must Be True** and **Most Strongly Supported** questions where you chain statements together and have to figure out what can validly be inferred.

---

## 4. The Contrapositive

Already introduced in section 1, but important enough for its own entry.

**Rule:** If A → B is true, then ~B → ~A is always true.

**Why it matters:** The LSAT frequently hides the logical connection between statements by stating them in contrapositives. You need to be able to flip and negate instantly.

### Practice
- "All politicians are public speakers" → A politician = public speaker
  - Contrapositive: Not a public speaker → not a politician ✅
- "Only members can vote" → Voting → member
  - Contrapositive: Not a member → cannot vote ✅

---

## 5. Argument Structure Terms

Every LR stimulus is an argument. You need to identify these parts instantly.

### Conclusion
**What:** The main point the author is trying to prove. The claim they want you to accept.
**Signal words:** "therefore," "thus," "hence," "so," "consequently," "it follows that," "clearly," "obviously"
**Key tip:** The conclusion is NOT always at the end. It can be anywhere in the stimulus.

### Premise
**What:** The evidence or reasons given to support the conclusion.
**Signal words:** "because," "since," "given that," "as evidenced by," "for," "after all"
**Key tip:** Premises are taken as true on the LSAT — you never attack them, only the reasoning connecting them to the conclusion.

### Assumption
**What:** An unstated premise the argument depends on — a gap between the premises and conclusion that the author takes for granted.
**Key tip:** The assumption is always something the author believes but never says. Finding it is the core skill of LR.

### Inference
**What:** A conclusion that logically follows from given statements — something that MUST be true if the premises are true.
**Key tip:** On the LSAT, a valid inference must be 100% supported. "Strongly suggested" is not enough for Must Be True questions.

---

## 6. Common Argument Flaws

These recurring errors in reasoning show up constantly in Flaw questions. Learn to name them on sight.

| Flaw | What It Is | Example |
|------|-----------|---------|
| **Correlation → Causation** | Assumes one thing caused another just because they occur together | "Crime went up after the policy changed, so the policy caused crime" |
| **Unrepresentative Sample** | Draws a conclusion about a whole group from an unrepresentative subset | "All 10 people I surveyed love jazz, therefore everyone loves jazz" |
| **Ad Hominem** | Attacks the person making the argument instead of the argument itself | "You can't trust his economic policy — he filed for bankruptcy once" |
| **Appeal to Authority** | Treats someone's opinion as fact just because they're an expert | "Dr. Smith says it's safe, so it must be" |
| **Appeal to Popularity** | Assumes something is true because many people believe it | "Most people think vaccines cause autism, so they must" |
| **Circular Reasoning** | Uses the conclusion as a premise | "This book is great because it's an excellent read" |
| **False Dichotomy** | Presents only two options when more exist | "You're either with us or against us" |
| **Equivocation** | Uses the same word in two different senses | "Laws of nature can't be broken. Laws against theft can be broken. Therefore theft is natural." |
| **Part to Whole** | Assumes what's true of parts is true of the whole | "Each ingredient is healthy, so the meal must be healthy" |
| **Whole to Part** | Assumes what's true of the whole is true of each part | "The team is the best in the league, so every player must be elite" |
| **Absence of Evidence** | Treats lack of evidence for X as proof X doesn't exist | "We've never found evidence of life on Mars, so there is none" |
| **Appeal to Emotion** | Uses emotional language to substitute for logical evidence | "Think of the children! We must pass this law." |

---

## 7. Negation Test (for Necessary Assumptions)

A specific technique for Necessary Assumption questions.

**How it works:** Negate (reverse) each answer choice. If negating the answer destroys the argument, that answer is a necessary assumption. If negating it doesn't affect the argument, it's wrong.

**Example:**
Argument: "All successful lawyers work hard. Jon works hard. Therefore Jon will be a successful lawyer."
Potential necessary assumption: "Working hard is sufficient for success as a lawyer."
Negated: "Working hard is NOT sufficient for success as a lawyer."
→ This destroys the argument. ✅ Necessary assumption confirmed.

---

## 8. Signal Words Master List

### Conclusion Signals
therefore, thus, hence, so, consequently, it follows that, clearly, obviously, must be, shows that, demonstrates that, concludes that, proves that

### Premise Signals
because, since, given that, as evidenced by, for, after all, in light of, due to, as shown by, the reason is, as indicated by

### Sufficient Condition Signals
if, when, whenever, all, every, each, any, anyone who, whoever, in order to

### Necessary Condition Signals
only if, must, requires, necessary, essential, depends on, unless, without, cannot...unless

### Contrast Signals (important for RC)
however, but, although, even though, despite, nevertheless, nonetheless, yet, while, whereas, on the other hand

### Quantifier Signals
all, every, no, none, some, most, many, few, several, a number of, the majority of

---

*Note created: 2026-06-06 | Chat*
*Update this note as new concepts are encountered throughout prep*
