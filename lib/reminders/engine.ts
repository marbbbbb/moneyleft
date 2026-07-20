import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Generates a short, supportive nudge for a rule the user set for themselves and
// has gone past. Observation + encouragement only — never financial advice,
// never shaming.

const MODEL = "claude-haiku-4-5";

const submitTool = {
  name: "submit_reminder",
  description: "Submit the reminder to show the user.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: {
        type: "string",
        description: "Short, warm headline. Under 60 characters. No emoji.",
      },
      body: {
        type: "string",
        description:
          "2–3 short sentences: kindly state the fact, then offer ONE gentle, practical suggestion. No emoji.",
      },
    },
    required: ["title", "body"],
  },
  strict: true,
};

const SYSTEM = `You write brief, supportive spending reminders for a personal finance app.

The user set this goal for themselves and has gone past it. They are checking in on their own money — they are not in trouble, and you are not their judge.

TONE RULES — these are strict:
- Be warm, kind, and matter-of-fact. Assume good intent. Life happens, and a number going over is information, not a failure.
- NEVER shame, scold, moralise, guilt-trip, or imply irresponsibility.
- NEVER use words like: overspent, splurged, bad, guilty, shame, discipline, failed, should have, need to be careful, blew.
- Do not be patronising or use forced cheerfulness. No exclamation marks. No emoji.
- State the fact plainly and kindly, then offer exactly ONE gentle, practical, resourceful suggestion they could try. Keep the suggestion small and doable.
- Frame it as an observation and an offer of help, never an instruction.

SCOPE — these are strict:
- You are in observation and encouragement mode ONLY.
- Do NOT give financial advice, investment advice, tax advice, or debt advice.
- Do NOT tell them what to do with their money, recommend products, or make projections.
- Do NOT moralise about the category they spent on. Their priorities are their own.

Keep it very short: a title under 60 characters and 2–3 sentences of body. Then call submit_reminder.`;

export type ReminderContext = {
  ruleLabel: string;
  actual: number;
  target: number;
  category?: string | null;
  isSavingsTarget?: boolean;
  spenderType?: string | null;
  savingToward?: string | null;
};

export async function generateReminder(
  ctx: ReminderContext,
): Promise<{ title: string; body: string }> {
  const client = new Anthropic();

  const fact = ctx.isSavingsTarget
    ? `They aimed to put aside ${ctx.target.toLocaleString()} this month. So far the difference between money in and money out is ${ctx.actual.toLocaleString()}.`
    : `They set a limit of ${ctx.target.toLocaleString()} for ${ctx.category ? `"${ctx.category}"` : "total spending"} this month. So far it is ${ctx.actual.toLocaleString()}.`;

  const context: string[] = [];
  if (ctx.spenderType) context.push(`They describe themselves as: ${ctx.spenderType}.`);
  if (ctx.savingToward) context.push(`They are saving toward: ${ctx.savingToward}.`);

  const prompt = [
    `Rule: ${ctx.ruleLabel}`,
    fact,
    ...context,
    "",
    "Write the reminder. Amounts are in the currency they record transactions in — do not add a currency symbol.",
  ].join("\n");

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM,
    tools: [submitTool] as never,
    tool_choice: { type: "tool", name: "submit_reminder" } as never,
    messages: [{ role: "user", content: prompt }],
  });

  const submit = (resp.content as unknown[]).find((block) => {
    const b = block as { type: string; name?: string };
    return b.type === "tool_use" && b.name === "submit_reminder";
  }) as { input: { title: string; body: string } } | undefined;

  if (!submit) throw new Error("Couldn't generate a reminder. Please try again.");

  const title = String(submit.input.title ?? "").trim();
  const body = String(submit.input.body ?? "").trim();
  if (!title || !body) throw new Error("The reminder came back empty.");

  return { title, body };
}
