interface BaseField {
  id: string
  label: string
  placeholder?: string
}

export type InputField =
  | (BaseField & { type: 'text' | 'textarea' })
  | (BaseField & { type: 'select'; options: string[] })

export interface AppConfig {
  name: string
  tagline: string
  systemPrompt: string
  inputs: InputField[]
  outputLabel: string
  accentColor: 'cyan' | 'emerald' | 'violet' | 'orange' | 'rose' | 'blue'
}
