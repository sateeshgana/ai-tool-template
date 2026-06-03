export interface InputField {
  id: string
  label: string
  type: 'text' | 'textarea' | 'select'
  placeholder?: string
  options?: string[]
}

export interface AppConfig {
  name: string
  tagline: string
  systemPrompt: string
  inputs: InputField[]
  outputLabel: string
  accentColor: 'cyan' | 'emerald' | 'violet' | 'orange' | 'rose' | 'blue'
}
