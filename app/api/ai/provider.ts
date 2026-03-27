import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'

export function getAIModel(settings: any) {
  const providerType = settings?.ai_provider || 'google'
  const modelStr = settings?.ai_model_selection || 'gemini-2.5-flash'
  const keyOverride = settings?.ai_api_key_override

  if (providerType === 'anthropic') {
    const anthropic = createAnthropic({ apiKey: keyOverride || process.env.ANTHROPIC_API_KEY || '' })
    return anthropic(modelStr)
  }
  
  if (providerType === 'openai') {
    const openai = createOpenAI({ apiKey: keyOverride || process.env.OPENAI_API_KEY || '' })
    return openai(modelStr)
  }

  // Fallback to Google
  const google = createGoogleGenerativeAI({ apiKey: keyOverride || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '' })
  return google(modelStr)
}
