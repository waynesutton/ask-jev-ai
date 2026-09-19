// Every judgment Jev makes about a message, plus the thresholds code uses
// to act on them. This is the one file a reviewer needs to read.
//
// The state sent with each request is { message: "<three to fifteen words>" }.
// Question ids are for code only and are not shown to the model.

import type { Question } from "./lib/typesafe";

export const MOOD_LEVELS = [
  "Sad, upset, or angry",
  "Flat or neutral",
  "Content or calm",
  "Happy or warm",
  "Joyful or excited",
] as const;

export const MOOD_LABELS = ["LOW", "FLAT", "CALM", "HAPPY", "JOYFUL"] as const;

export const TOPICS = {
  life: "Everyday life, feelings, family, friends",
  work: "Jobs, school, studying, building things",
  love: "Affection, romance, gratitude toward someone",
  food: "Eating, cooking, drinks, snacks",
  nature: "Weather, animals, plants, outdoors, seasons",
  tech: "Computers, software, phones, the internet",
  humor: "Jokes, puns, silliness, playful nonsense",
  other: "Anything that does not fit the options above",
} as const;

export type Topic = keyof typeof TOPICS;

// How Jev answers the ask itself. A Choice, so it can only pick, never
// generate. Two no match outcomes cover asks that are not yes or no.
export const REPLIES = {
  yes: "A yes or no question whose honest answer, from common knowledge or from what Jev is, is yes. Examples: is water wet; do you have any answer other than depends",
  no: "A yes or no question whose honest answer, from common knowledge, is no. Example: can pigs fly",
  depends:
    "A question that cannot be settled from common knowledge: it is personal, unknowable, or a matter of taste. Example: will I be happy next year",
  open: "A question that wants more than yes or no: what, why, how, who, which. Example: what should I eat tonight",
  statement: "Not a question at all. Example: my dog learned a trick",
} as const;

export type Reply = keyof typeof REPLIES;

export const QUESTIONS = {
  reply: {
    type: "choice",
    // The model knows nothing about Jev unless told, so asks aimed at "you"
    // ("do you know", "can you", "are you") came back open or depends. One
    // sentence of self knowledge lets it answer those honestly.
    instructions:
      "Read `message` as something a person asked Jev. If it is a yes or no question, answer it honestly using common knowledge. Jev is a judge that answers every ask with yes, no, or it depends, in one short call, with no memory, no chat, and no browsing; use that when the ask is about Jev itself. Otherwise say what kind of message it is.",
    criteria: { ...REPLIES },
  },
  is_unkind: {
    type: "noul",
    instructions:
      "Is `message` insulting, mocking, hostile, or mean toward anyone, even if every individual word is ordinary?",
    criteria: {
      true: "Puts someone down, sneers, threatens, or expresses contempt. Example: you are so stupid",
      false:
        "Neutral, kind, playful, or self directed without cruelty. Example: my dog is so silly",
    },
  },
  is_adult: {
    type: "noul",
    instructions:
      "Does `message` contain sexual, violent, or otherwise adult content, including innuendo or coded slang that does not belong on a public wall?",
    criteria: {
      true: "Sexual references, graphic violence, drugs, or coded adult slang",
      false: "Fine for a public wall anyone can read",
    },
  },
  targets_person: {
    type: "noul",
    instructions:
      "Does `message` attack, threaten, or demean a specific real person or a group of people based on who they are?",
    criteria: {
      true: "Names or clearly points at a person or group and treats them badly",
      false: "No target, or a target treated with respect",
    },
  },
  mood: {
    type: "score",
    instructions: "What is the emotional tone of `message`?",
    criteria: [...MOOD_LEVELS],
  },
  topic: {
    type: "choice",
    instructions: "What is `message` mostly about?",
    criteria: { ...TOPICS },
  },
} as const satisfies Record<string, Question>;

export type QuestionId = keyof typeof QUESTIONS;

// Any one hazard at or above this probability blocks the message.
// Tune on real data. The guardrails cookbook starts at 0.7. This wall is
// public and unmoderated by humans so it leans stricter.
export const BLOCK_THRESHOLD = 0.6;

// How many times the judge retries a failed TypeSafe call before giving up.
export const MAX_JUDGE_ATTEMPTS = 3;
