---
tags: [lsat, logical-reasoning, formal-logic, conditional]
related: "[[LSAT Prep Hub]], [[LR - Argument Structure]], [[LR - Question Types]], [[LR - Common Flaws]]"
---

# LR — Conditional Logic

> Conditional logic appears in ~20–30% of LR questions. Get this cold.
> Back to [[LSAT Prep Hub]]

---

## The Core Structure

A conditional statement says: **If [sufficient condition], then [necessary condition].**

- **Sufficient condition (S):** Guarantees the necessary condition. Its presence alone is enough.
- **Necessary condition (N):** Must be present whenever the sufficient is present. Doesn't guarantee anything on its own.

```
If A → B
```
Read: "If A, then B." / "A is sufficient for B." / "B is necessary for A."

---

## The Four Inferences

Given: **If A → B**

| Inference | Valid? | Form |
|-----------|--------|------|
| A is true → B must be true | ✅ Valid | Modus Ponens |
| B is false → A must be false | ✅ Valid | **Contrapositive** |
| B is true → A must be true | ❌ Invalid | **Mistaken Reversal** |
| A is false → B must be false | ❌ Invalid | **Mistaken Negation** |

---

## The Contrapositive

The contrapositive is **always** logically equivalent to the original.

| Original | Contrapositive |
|----------|---------------|
| If A → B | If ~B → ~A |
| If tall → plays basketball | If doesn't play basketball → not tall |

**How to form it:** Flip and negate both sides.

---

## Common Translations

| English | Logical Form |
|---------|-------------|
| "All A are B" | A → B |
| "No A are B" | A → ~B |
| "Every A is B" | A → B |
| "A only if B" | A → B |
| "A unless B" | ~B → A |
| "Without B, no A" | ~B → ~A (same as A → B) |
| "The only A are B" | A → B |
| "B is required for A" | A → B |
| "B is necessary for A" | A → B |
| "A is sufficient for B" | A → B |
| "Whenever A, B" | A → B |
| "Neither A nor B" | ~A and ~B |

---

## Tricky Words to Watch

### "Only if"
"A only if B" means **A → B** (not B → A).
*"You can enter only if you have a ticket"* = Have ticket is necessary for entering = Enter → Have ticket.

### "Unless"
"A unless B" = "If not B, then A" = **~B → A**
Contrapositive: **~A → B**
*"I'll go unless it rains"* = ~Rain → Go / ~Go → Rain

### "The only"
"The only X that are Y are Z" = Y → Z (among X's)

---

## Chaining Conditionals

If you have:
- A → B
- B → C

Then you can conclude: **A → C**

This is called a **chain**. Always look for opportunities to chain conditionals together in the stimulus.

---

## Biconditionals

Some statements go both ways: "A if and only if B" means A → B AND B → A.
These are rare but worth recognizing.

---

## Common LSAT Mistakes

1. **Mistaken Reversal:** Seeing "All lawyers passed the bar" and concluding "Anyone who passed the bar is a lawyer." (Wrong — others can pass too.)
2. **Mistaken Negation:** Seeing "If you study, you'll pass" and concluding "If you don't study, you won't pass." (Wrong.)
3. **Confusing necessary with sufficient:** Just because B is required for A doesn't mean B alone *causes* or *guarantees* A.

---

## Practice Template

For any conditional you encounter, write out:
1. **Original:** If ___ → ___
2. **Contrapositive:** If ~___ → ~___
3. **Invalid reversal (for reference):** If ___ → ___ ❌
4. **Invalid negation (for reference):** If ~___ → ~___ ❌

---

## Linked Notes
- [[LR - Argument Structure]] — conditionals are a special type of argument structure
- [[LR - Question Types]] — SA and NA questions often involve formal logic
- [[LR - Common Flaws]] — necessary vs. sufficient confusion is a major flaw type
- [[LSAT Prep Hub]]
