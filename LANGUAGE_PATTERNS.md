# Language patterns

How to write user-facing copy in this project. Voice is **conversational with edge** — talks to the reader like a senior IC who has opinions. Concrete artifacts (PRDs, Gong calls, GitHub PRs, Linear issues) over abstractions ("workflows", "intelligence", "context"). Slightly opinionated, occasionally funny. No buzzwords.

## Banned words

Replace, don't reuse:

`AI-native` · `AI-powered` · `transform(s)` · `unlock` · `leverage` · `seamless(ly)` · `streamline` · `elevate` · `revolutionize` · `harness` · `supercharge` · `accelerate` · `empower(s)` · `comprehensive` · `actionable` · `holistic` · `robust` · `cutting-edge` · `next-gen(eration)` · `world-class` · `enterprise-grade` · `intelligence layer` · `living knowledge` · `every stage` · `entire workflow` · `solutions` · `experiences` · `journeys` · `favorite tools` · `your entire X` · `purpose-built` · `grounded in` · `bring AI into` · `let AI power`

## Banned patterns

- "Not just X — it's Y"
- "More than just"
- Tricolons of abstract nouns ("plan, build, ship", "code, docs, and intelligence")
- "The more you X, the smarter it gets"
- "Built for the future of [noun]"
- "Built for modern teams" / "designed to scale"
- "We believe..." manifesto openings without a payoff
- "Ready to [verb]?" CTAs (use a concrete promise instead)
- Mid-sentence em-dash parentheticals (use periods, or rewrite)
- Anthropomorphic verbs without specifics ("the AI watches/understands/reads/listens")
- Capitalized abstractions used as if self-explanatory (Product Graph, Intelligence Layer)
- "Save hours every week" without a real measurement
- "Stop doing [bad thing]" without naming the thing

## Banned filler phrases

These are discourse markers that signal "I'm about to say something important" without doing the work. They're the verbal tic of LLM-generated blog posts. Cut them and start with the actual sentence.

- "Here's the thing:" / "Here's the thing —"
- "Here's the kicker:" / "Here's the catch:" / "Here's why this matters:"
- "Let's be honest" / "Let's be real" / "Let's face it"
- "The truth is" / "The reality is" / "The fact is"
- "It's no secret that" / "It goes without saying"
- "At the end of the day" / "When all is said and done"
- "The bottom line is" / "Make no mistake"
- "It's worth noting that" / "It's important to note"
- "Look, ..." / "Listen, ..." as a sentence-opener
- "In today's fast-paced world" / "In the world of [X]" / "In the era of [X]"
- "When it comes to [X]" (just write about X)
- "Now, ..." as a transition
- "But wait, there's more"
- "Spoiler:" / "Plot twist:" as rhetorical setup

If you find yourself writing one, the sentence after it is the real sentence. Delete the opener.

## Required moves

- Name the actual artifact: PRD, tech spec, one-pager, Gong call, GitHub PR, Linear issue, Jira ticket, transcript, commit message, README
- Replace adjective stacks with one verb-object pair
- If a sentence claims a benefit, the next sentence shows the mechanism — or the claim is cut
- Headlines: under ~8 words
- Subheads: under ~20 words
- Use straight apostrophes (`'`) in JS string literals; use `&rsquo;` only inside JSX text content
- Use `—` (em-dash) sparingly. Prefer a period.

## Style rules

- Punchy headline → mechanism subhead → CTA. The subhead is where you prove the headline.
- Subjects do things. Avoid "is powered by", "is informed by", "is built from".
- Concrete numbers beat vague comparisons ("60 seconds", not "fast"). If you don't have the number, drop the claim.
- Brand names beat categories ("GitHub", not "code repos"; "Gong", not "call recording tools").
- Mock CTAs reveal: "Connect your GitHub. See a PRD in 60 seconds." > "Get started today".
- Minor self-deprecation is fine ("the blank page is somebody else's problem"). Hero-talk is not.
- One joke per page max. Save it for the headline or final CTA.

## Before / after examples

**Hero**

- ❌ "Pull in calls, research, and code. Cluster themes on the canvas. Generate one-pagers, PRDs, tech designs, and specs your AI agents can ship — with an AI that actually knows what you're working on."
- ✅ "foundation reads your GitHub, Gong calls, and Notion docs, then drafts the PRD. You edit, push to Linear or Jira, ship. The blank page is somebody else's problem."

**Section headline**

- ❌ "Three ways foundation transforms your workflow"
- ✅ "Three things foundation does"

**Final CTA**

- ❌ "Ready to build your product graph? Connect your sources and let AI power your entire product workflow — from chat to calls to plans."
- ✅ "Connect your GitHub. See a PRD in 60 seconds. Free to try. No card."

**Footer tagline**

- ❌ "AI-native platform for product development."
- ✅ "The product tool that already read your repo."

**Feature card description**

- ❌ "AI-powered chat that understands your entire product context. @mention code, docs, issues, and calls. Every answer is grounded in your product graph."
- ✅ "Chat with @mentions for your code, docs, Linear issues, and Gong calls. Answers cite the file or transcript they came from. No hallucinated function names."

## Verifying

After writing copy, run:

```sh
grep -niE 'AI-native|AI-powered|transform[^A-Z]|unlock|leverage|seamless|streamline|elevate|revolutionize|harness|supercharge|empower|comprehensive|actionable|holistic|cutting-edge|next-gen|world-class|enterprise-grade|intelligence layer|living knowledge|every stage|entire workflow|favorite tools' web/app web/components website/app website/components admin/app admin/components
```

And for filler-phrase openers:

```sh
grep -niE "here'?s the (thing|kicker|catch)|let'?s be (honest|real)|let'?s face it|the (truth|reality|fact) is|it'?s no secret|at the end of the day|the bottom line|make no mistake|it'?s worth noting|in today'?s fast-paced|when it comes to|spoiler:|plot twist:" web/app web/components website/app website/components admin/app admin/components
```

Zero hits in marketing copy. CSS class names like `transition-transform` will match — ignore those.

## Out-of-scope

Legal text (privacy, terms, subprocessors) and form validation messages can be plain. The voice rules apply to: hero copy, section headlines, feature descriptions, page metadata, FAQ answers, blog post titles + descriptions, integration descriptions, CTAs.