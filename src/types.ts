import * as anthropic from '@anthropic-ai/sdk'
import * as openai from 'openai-fetch'
import type { Options as RetryOptions } from 'p-retry'
import type { JsonObject } from 'type-fest'
import { SafeParseReturnType, ZodType, ZodTypeAny, output, z } from 'zod'

import type { Agentic } from './agentic'

export { openai }
export { anthropic }

export type ParsedData<T extends ZodTypeAny> = T extends ZodTypeAny
  ? output<T>
  : never

export type SafeParsedData<T extends ZodTypeAny> = T extends ZodTypeAny
  ? SafeParseReturnType<z.infer<T>, ParsedData<T>>
  : never

export interface BaseTaskOptions {
  agentic: Agentic

  timeoutMs?: number
  retryConfig?: RetryConfig
  id?: string

  // TODO
  // caching config
  // logging config
  // human feedback config
}

export interface BaseLLMOptions<
  TInput = void,
  TOutput = string,
  TModelParams extends Record<string, any> = Record<string, any>
> extends BaseTaskOptions {
  inputSchema?: ZodType<TInput>
  outputSchema?: ZodType<TOutput>

  provider?: string
  model?: string
  modelParams?: TModelParams
  examples?: LLMExample[]
}

export interface LLMOptions<
  TInput = void,
  TOutput = string,
  TModelParams extends Record<string, any> = Record<string, any>
> extends BaseLLMOptions<TInput, TOutput, TModelParams> {
  promptTemplate?: string
  promptPrefix?: string
  promptSuffix?: string
}

// export type ChatMessageRole = 'user' | 'system' | 'assistant'
export const ChatMessageRoleSchema = z.union([
  z.literal('user'),
  z.literal('system'),
  z.literal('assistant')
])
export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>

export interface ChatMessage {
  role: ChatMessageRole
  content: string
  name?: string
}

export interface ChatModelOptions<
  TInput = void,
  TOutput = string,
  TModelParams extends Record<string, any> = Record<string, any>
> extends BaseLLMOptions<TInput, TOutput, TModelParams> {
  messages: ChatMessage[]
}

export interface BaseChatCompletionResponse<
  TChatCompletionResponse extends Record<string, any> = Record<string, any>
> {
  /** The completion message. */
  message: ChatMessage

  /** The raw response from the LLM provider. */
  response: TChatCompletionResponse
}

export interface LLMExample {
  input: string
  output: string
}

export interface RetryConfig extends RetryOptions {
  strategy?: string
}

export interface TaskResponseMetadata extends Record<string, any> {
  // task info
  taskName: string
  taskId: string

  // execution info
  success?: boolean
  error?: Error
  numRetries?: number
  callId?: string
}

export interface LLMTaskResponseMetadata<
  TChatCompletionResponse extends Record<string, any> = Record<string, any>
> extends TaskResponseMetadata {
  completion?: TChatCompletionResponse
}

export interface TaskResponse<
  TOutput = string,
  TMetadata extends TaskResponseMetadata = TaskResponseMetadata
> {
  result: TOutput
  metadata: TMetadata
}

export interface TaskCallContext<
  TInput = void,
  TMetadata extends TaskResponseMetadata = TaskResponseMetadata
> {
  input?: TInput
  retryMessage?: string

  attemptNumber: number
  metadata: TMetadata
}

export type IDGeneratorFunction = () => string

export interface SerializedTask extends JsonObject {
  _taskName: string
}

// export type ProgressFunction = (partialResponse: ChatMessage) => void
