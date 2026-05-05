import React from 'react';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  agentId?: string;
  content: string;
  images?: string[];
  audioUrl?: string;
  isTool?: boolean;
  usage?: { promptTokens: number; candidatesTokens: number; totalTokens: number };
  toolExecutions?: { toolName: string; args: string }[];
};

export type LogEvent = {
  id: string;
  timestamp: string;
  agentId: string;
  type: string;
  level: string;
  message: string;
  data: any;
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working';
  icon: React.ReactNode;
  progress?: number;
  estimate?: number;
};

export type AgentDetails = {
  agentId: string;
  rules: string;
  skills: any[];
  memory: {
    task: string;
    longTerm: string;
  };
};

export type SystemStats = {
  total_input_tokens: number;
  total_output_tokens: number;
  total_requests: number;
};

export type KeyStatus = {
  hasGemini: boolean;
  hasTavily: boolean;
  hasTelegram: boolean;
  hasPerplexity: boolean;
};

export type DetailedStat = {
  date: string;
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
};
