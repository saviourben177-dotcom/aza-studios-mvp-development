import Groq from 'groq-sdk'

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables.')
}

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `You are Aza, an AI employee embedded in a sales/growth dashboard called Aza Studios.
You help with lead research, drafting outreach, and summarizing pipeline activity.
You operate in read-and-prepare mode only: you never claim to have sent an email, updated a CRM record,
or taken any external action beyond adding a lead record the user explicitly asked you to add.
If asked to do something external (sending an email, calling someone), describe it as a drafted task
awaiting the user's approval instead — do not claim to have done it.
When the user asks you to add, log, or track a company as a lead, call the add_lead tool — don't just
describe it in text. Only call add_lead when the user clearly asks for a specific company to be added.
Keep replies concise (2-4 sentences) and concrete.`

const tools: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'add_lead',
      description: "Add a new lead/prospect to the user's pipeline. Only call this when the user explicitly asks to add, log, or track a specific company.",
      parameters: {
        type: 'object',
        properties: {
          company: { type: 'string', description: 'Company name' },
          detail: { type: 'string', description: 'Short one-line description of the company or why it is a fit' },
          score: { type: 'number', description: 'Fit score 0-100, if the user gave or implied one' },
          contactName: { type: 'string', description: 'Named contact at the company, if mentioned' },
        },
        required: ['company'],
      },
    },
  },
]

export type AddLeadArgs = { company: string; detail?: string; score?: number; contactName?: string }

export async function getAgentReply(
  history: { role: 'user' | 'assistant'; content: string }[],
  onAddLead: (args: AddLeadArgs) => Promise<{ company: string }>,
) {
  const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
  ]

  const first = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0.4,
    max_tokens: 400,
  })

  const choice = first.choices[0]
  const toolCalls = choice?.message?.tool_calls

  if (!toolCalls?.length) {
    return choice?.message?.content?.trim() || "I wasn't able to generate a reply — try again."
  }

  messages.push(choice.message)

  for (const call of toolCalls) {
    if (call.function.name !== 'add_lead') continue
    let args: AddLeadArgs
    try {
      args = JSON.parse(call.function.arguments)
    } catch {
      messages.push({ role: 'tool', tool_call_id: call.id, content: 'Error: could not parse arguments' })
      continue
    }
    if (!args.company) {
      messages.push({ role: 'tool', tool_call_id: call.id, content: 'Error: company is required' })
      continue
    }
    const result = await onAddLead(args)
    messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ added: result.company }) })
  }

  const second = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.4,
    max_tokens: 300,
  })

  return second.choices[0]?.message?.content?.trim() || 'Done.'
}
