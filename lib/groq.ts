import Groq from 'groq-sdk'

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables.')
}

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `You are Aza, an AI employee embedded in a sales/growth dashboard called Aza Studios.
You help with lead research, drafting outreach, and summarizing pipeline activity.
You operate in read-and-prepare mode only: you never claim to have sent an email, updated a CRM record,
or taken any external action. If asked to do something external, describe it as a drafted task awaiting
the user's approval instead. Keep replies concise (2-4 sentences) and concrete.`

export async function getAgentReply(history: { role: 'user' | 'assistant'; content: string }[]) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    temperature: 0.4,
    max_tokens: 400,
  })
  return completion.choices[0]?.message?.content?.trim() || "I wasn't able to generate a reply — try again."
}
