// Tiny typed client for the TypeSafe System One HTTP API.
// Docs: https://docs.typesafe.ai/api
//
// Uses fetch so it runs in the default Convex runtime. No SDK, no "use node".

export const TYPESAFE_ENDPOINT = "https://api.typesafe.ai/v1/systemone";
export const TYPESAFE_MODEL = "jev-latest";

// The same model as the Convex AI Gateway lists it. Decisions models do
// not appear in GET /v1/models, so this cannot be discovered at runtime.
// Lives here, not in jev.ts, so the docs page can import it without
// pulling convex/server into the browser bundle.
export const JEV_GATEWAY_MODEL = "typesafe/jev-1.13";

type Entry = string | Record<string, unknown> | Array<unknown>;

export type NoulQuestion = {
  type: "noul";
  instructions: Entry;
  criteria?: { true?: Entry; false?: Entry };
};

export type ChoiceQuestion = {
  type: "choice";
  instructions: Entry;
  criteria: Record<string, string | null>;
};

export type ScoreQuestion = {
  type: "score";
  instructions: Entry;
  criteria: ReadonlyArray<string | null>;
};

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type NoulAnswer = { type: "noul"; noul: number };

export type ChoiceAnswer = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};

export type ScoreAnswer = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

// Maps each question id to the answer type its question produces.
export type AnswersFor<Q extends Record<string, Question>> = {
  [K in keyof Q]: Q[K] extends NoulQuestion
    ? NoulAnswer
    : Q[K] extends ChoiceQuestion
      ? ChoiceAnswer
      : ScoreAnswer;
};

export type SystemOneResponse<Q extends Record<string, Question>> = {
  model: string;
  answers: AnswersFor<Q>;
  usage: { input_tokens: number; output_tokens: number };
};

export class TypeSafeError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "TypeSafeError";
  }
}

// One request, every question evaluated in parallel against the same state.
export async function systemOne<Q extends Record<string, Question>>(args: {
  apiKey: string;
  state: unknown;
  questions: Q;
}): Promise<SystemOneResponse<Q>> {
  const response = await fetch(TYPESAFE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      state: args.state,
      model: TYPESAFE_MODEL,
      questions: args.questions,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new TypeSafeError(
      response.status,
      `TypeSafe ${response.status}: ${detail.slice(0, 300)}`,
    );
  }

  return (await response.json()) as SystemOneResponse<Q>;
}
