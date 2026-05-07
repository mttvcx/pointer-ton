import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import OpenAI from 'openai';
import { MODELS } from '@/lib/utils/constants';

let _anthropic: Anthropic | null = null;
let _gemini: GoogleGenerativeAI | null = null;
let _geminiFlash: GenerativeModel | null = null;
let _openai: OpenAI | null = null;

export function getAnthropic(): Anthropic {
  if (_anthropic) return _anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing');
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

export function getGemini(): GoogleGenerativeAI {
  if (_gemini) return _gemini;
  const key = process.env.GOOGLE_GEMINI_API_KEY;
  if (!key) throw new Error('GOOGLE_GEMINI_API_KEY missing');
  _gemini = new GoogleGenerativeAI(key);
  return _gemini;
}

export function getGeminiFlash(): GenerativeModel {
  if (_geminiFlash) return _geminiFlash;
  _geminiFlash = getGemini().getGenerativeModel({
    model: MODELS.geminiFlash,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });
  return _geminiFlash;
}

export function getOpenAI(): OpenAI {
  if (_openai) return _openai;
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing');
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

export type AIProvider = 'gemini' | 'anthropic' | 'openai';
