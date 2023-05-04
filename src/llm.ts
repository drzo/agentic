import type { SetRequired } from 'type-fest'
import { ZodRawShape, ZodTypeAny, z } from 'zod'

import * as types from './types'

const defaultOpenAIModel = 'gpt-3.5-turbo'

export class Agentic {
  _client: types.openai.OpenAIClient
  _verbosity: number
  _defaults: Pick<
    types.BaseLLMOptions,
    'provider' | 'model' | 'modelParams' | 'timeoutMs' | 'retryConfig'
  >

  constructor(opts: {
    openai: types.openai.OpenAIClient
    verbosity?: number
    defaults?: Pick<
      types.BaseLLMOptions,
      'provider' | 'model' | 'modelParams' | 'timeoutMs' | 'retryConfig'
    >
  }) {
    this._client = opts.openai
    this._verbosity = opts.verbosity ?? 0
    this._defaults = {
      provider: 'openai',
      model: defaultOpenAIModel,
      modelParams: {},
      timeoutMs: 30000,
      retryConfig: {
        attempts: 3,
        strategy: 'heal',
        ...opts.defaults?.retryConfig
      },
      ...opts.defaults
    }
  }

  gpt4(
    promptOrChatCompletionParams: string | types.openai.ChatCompletionParams
  ) {
    let options: Omit<types.openai.ChatCompletionParams, 'model'>

    if (typeof promptOrChatCompletionParams === 'string') {
      options = {
        messages: [
          {
            role: 'user',
            content: promptOrChatCompletionParams
          }
        ]
      }
    } else {
      options = promptOrChatCompletionParams

      if (!options.messages) {
        throw new Error('messages must be provided')
      }
    }

    return new OpenAIChatModelBuilder(this._client, {
      ...(this._defaults as any), // TODO
      model: 'gpt-4',
      ...options
    })
  }
}

export abstract class BaseLLMCallBuilder<
  TInput extends ZodRawShape | ZodTypeAny = ZodTypeAny,
  TOutput extends ZodRawShape | ZodTypeAny = z.ZodType<string>,
  TModelParams extends Record<string, any> = Record<string, any>
> {
  _options: types.BaseLLMOptions<TInput, TOutput, TModelParams>

  constructor(options: types.BaseLLMOptions<TInput, TOutput, TModelParams>) {
    this._options = options
  }

  input<U extends ZodRawShape | ZodTypeAny = TInput>(
    inputSchema: U
  ): BaseLLMCallBuilder<U, TOutput, TModelParams> {
    ;(
      this as unknown as BaseLLMCallBuilder<U, TOutput, TModelParams>
    )._options.input = inputSchema
    return this as unknown as BaseLLMCallBuilder<U, TOutput, TModelParams>
  }

  output<U extends ZodRawShape | ZodTypeAny = TOutput>(
    outputSchema: U
  ): BaseLLMCallBuilder<TInput, U, TModelParams> {
    ;(
      this as unknown as BaseLLMCallBuilder<TInput, U, TModelParams>
    )._options.output = outputSchema
    return this as unknown as BaseLLMCallBuilder<TInput, U, TModelParams>
  }

  examples(examples: types.LLMExample[]) {
    this._options.examples = examples
    return this
  }

  retry(retryConfig: types.LLMRetryConfig) {
    this._options.retryConfig = retryConfig
    return this
  }

  abstract call(
    input?: types.ParsedData<TInput>
  ): Promise<types.ParsedData<TOutput>>

  // TODO
  // abstract stream({
  //   input: TInput,
  //   onProgress: types.ProgressFunction
  // }): Promise<TOutput>
}

export abstract class ChatModelBuilder<
  TInput extends ZodRawShape | ZodTypeAny = ZodTypeAny,
  TOutput extends ZodRawShape | ZodTypeAny = z.ZodType<string>,
  TModelParams extends Record<string, any> = Record<string, any>
> extends BaseLLMCallBuilder<TInput, TOutput, TModelParams> {
  _messages: types.ChatMessage[]

  constructor(options: types.ChatModelOptions<TInput, TOutput, TModelParams>) {
    super(options)

    this._messages = options.messages
  }
}

export class OpenAIChatModelBuilder<
  TInput extends ZodRawShape | ZodTypeAny = ZodTypeAny,
  TOutput extends ZodRawShape | ZodTypeAny = z.ZodType<string>
> extends ChatModelBuilder<
  TInput,
  TOutput,
  SetRequired<Omit<types.openai.ChatCompletionParams, 'messages'>, 'model'>
> {
  _client: types.openai.OpenAIClient

  constructor(
    client: types.openai.OpenAIClient,
    options: types.ChatModelOptions<
      TInput,
      TOutput,
      Omit<types.openai.ChatCompletionParams, 'messages'>
    >
  ) {
    super({
      provider: 'openai',
      model: defaultOpenAIModel,
      ...options
    })

    this._client = client
  }

  override async call(
    input?: types.ParsedData<TInput>
  ): Promise<types.ParsedData<TOutput>> {
    // TODO: construct messages

    const completion = await this._client.createChatCompletion({
      model: defaultOpenAIModel, // TODO: this shouldn't be necessary
      ...this._options.modelParams,
      messages: this._messages
    })

    if (this._options.output) {
      const schema =
        this._options.output instanceof z.ZodType
          ? this._options.output
          : z.object(this._options.output)

      // TODO: convert string => object if necessary
      // TODO: handle errors, retry logic, and self-healing

      return schema.parse(completion.message.content)
    } else {
      return completion.message.content as any
    }
  }
}
