import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../.env');

// In-memory runtime configuration
let llmConfig = {
  active_provider: process.env.LLM_PROVIDER || 'azure', // 'azure' | 'gemini'
  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    api_key: process.env.AZURE_OPENAI_API_KEY || '',
    api_version: process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview'
  },
  gemini: {
    api_key: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash'
  }
};

function maskKey(key) {
  if (!key || key.length < 6) return '';
  return `${key.slice(0, 3)}••••••••${key.slice(-3)}`;
}

export function getLLMConfig() {
  return {
    active_provider: llmConfig.active_provider,
    azure: {
      endpoint: llmConfig.azure.endpoint,
      deployment: llmConfig.azure.deployment,
      api_version: llmConfig.azure.api_version,
      has_key: Boolean(llmConfig.azure.api_key),
      masked_key: maskKey(llmConfig.azure.api_key)
    },
    gemini: {
      model: llmConfig.gemini.model,
      has_key: Boolean(llmConfig.gemini.api_key),
      masked_key: maskKey(llmConfig.gemini.api_key)
    }
  };
}

export async function updateLLMConfig(updates = {}) {
  if (updates.provider) {
    llmConfig.active_provider = updates.provider;
  }
  if (updates.azure_endpoint !== undefined) {
    llmConfig.azure.endpoint = updates.azure_endpoint.trim();
  }
  if (updates.azure_deployment !== undefined) {
    llmConfig.azure.deployment = updates.azure_deployment.trim();
  }
  if (updates.azure_api_version !== undefined) {
    llmConfig.azure.api_version = updates.azure_api_version.trim();
  }
  if (updates.azure_key !== undefined && updates.azure_key.trim()) {
    llmConfig.azure.api_key = updates.azure_key.trim();
  }
  if (updates.gemini_model !== undefined) {
    llmConfig.gemini.model = updates.gemini_model.trim();
  }
  if (updates.gemini_key !== undefined && updates.gemini_key.trim()) {
    llmConfig.gemini.api_key = updates.gemini_key.trim();
  }

  // Update process.env so other modules reflect change
  process.env.LLM_PROVIDER = llmConfig.active_provider;
  process.env.AZURE_OPENAI_ENDPOINT = llmConfig.azure.endpoint;
  process.env.AZURE_OPENAI_DEPLOYMENT = llmConfig.azure.deployment;
  process.env.AZURE_OPENAI_API_VERSION = llmConfig.azure.api_version;
  if (llmConfig.azure.api_key) process.env.AZURE_OPENAI_API_KEY = llmConfig.azure.api_key;
  if (llmConfig.gemini.api_key) process.env.GEMINI_API_KEY = llmConfig.gemini.api_key;
  process.env.GEMINI_MODEL = llmConfig.gemini.model;

  // Persist to .env if requested
  if (updates.persist_env) {
    try {
      let content = fs.existsSync(rootEnvPath) ? fs.readFileSync(rootEnvPath, 'utf8') : '';
      const setEnvVar = (name, val) => {
        const regex = new RegExp(`^${name}=.*$`, 'm');
        if (regex.test(content)) {
          content = content.replace(regex, `${name}=${val}`);
        } else {
          content += `\n${name}=${val}`;
        }
      };

      setEnvVar('LLM_PROVIDER', llmConfig.active_provider);
      setEnvVar('AZURE_OPENAI_ENDPOINT', llmConfig.azure.endpoint);
      setEnvVar('AZURE_OPENAI_DEPLOYMENT', llmConfig.azure.deployment);
      setEnvVar('AZURE_OPENAI_API_VERSION', llmConfig.azure.api_version);
      if (llmConfig.azure.api_key) setEnvVar('AZURE_OPENAI_API_KEY', llmConfig.azure.api_key);
      if (llmConfig.gemini.api_key) setEnvVar('GEMINI_API_KEY', llmConfig.gemini.api_key);
      setEnvVar('GEMINI_MODEL', llmConfig.gemini.model);

      fs.writeFileSync(rootEnvPath, content.trim() + '\n', 'utf8');
    } catch (err) {
      console.warn('[LLM] Could not persist to .env:', err.message);
    }
  }

  return getLLMConfig();
}

function buildAzureUrl(endpoint, deployment, apiVersion) {
  let cleanEndpoint = (endpoint || '').trim().replace(/\/+$/, '');
  if (cleanEndpoint.includes('/openai/deployments/')) {
    return cleanEndpoint;
  }
  return `${cleanEndpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion || '2024-08-01-preview'}`;
}

export async function testLLMConnection(targetProvider = null, customParams = {}) {
  const provider = targetProvider || llmConfig.active_provider;
  const startTime = Date.now();

  if (provider === 'azure') {
    const endpoint = customParams.azure_endpoint || llmConfig.azure.endpoint;
    const deployment = customParams.azure_deployment || llmConfig.azure.deployment;
    const key = customParams.azure_key || llmConfig.azure.api_key;
    const apiVersion = customParams.azure_api_version || llmConfig.azure.api_version;

    if (!endpoint) {
      return {
        success: false,
        provider: 'Azure OpenAI',
        error: 'Azure Endpoint URL is missing. Please provide your endpoint (e.g. https://your-resource.openai.azure.com/).'
      };
    }
    if (!key) {
      return {
        success: false,
        provider: 'Azure OpenAI',
        error: 'Azure OpenAI API Key is missing. Please provide a valid key.'
      };
    }

    const url = buildAzureUrl(endpoint, deployment, apiVersion);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': key
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a test ping agent. Answer with the word "pong".' },
            { role: 'user', content: 'Ping' }
          ],
          max_tokens: 5,
          temperature: 0.1
        }),
        signal: AbortSignal.timeout(10000)
      });

      const latencyMs = Date.now() - startTime;
      if (!response.ok) {
        const errorText = await response.text();
        let errMsg = `Azure OpenAI returned HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed.error && parsed.error.message) {
            errMsg += `: ${parsed.error.message}`;
          }
        } catch (_) {
          errMsg += `: ${errorText.slice(0, 150)}`;
        }
        return { success: false, provider: 'Azure OpenAI', model: deployment, latencyMs, error: errMsg };
      }

      return {
        success: true,
        provider: 'Azure OpenAI',
        model: deployment,
        latencyMs,
        message: `Successfully connected to Azure OpenAI deployment '${deployment}' (${latencyMs}ms)`
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        provider: 'Azure OpenAI',
        model: deployment,
        latencyMs,
        error: err.name === 'TimeoutError' ? 'Connection timed out (10s)' : err.message
      };
    }
  }

  // Gemini provider test
  if (provider === 'gemini') {
    const key = customParams.gemini_key || llmConfig.gemini.api_key;
    const model = customParams.gemini_model || llmConfig.gemini.model;

    if (!key) {
      return {
        success: false,
        provider: 'Google Gemini',
        error: 'Gemini API Key is missing. Please provide an API key.'
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Ping' }] }],
          generationConfig: { maxOutputTokens: 5, temperature: 0.1 }
        }),
        signal: AbortSignal.timeout(10000)
      });

      const latencyMs = Date.now() - startTime;
      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          provider: 'Google Gemini',
          model,
          latencyMs,
          error: `Gemini API returned HTTP ${response.status}: ${errText.slice(0, 150)}`
        };
      }

      return {
        success: true,
        provider: 'Google Gemini',
        model,
        latencyMs,
        message: `Successfully connected to Google Gemini model '${model}' (${latencyMs}ms)`
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      return {
        success: false,
        provider: 'Google Gemini',
        model,
        latencyMs,
        error: err.name === 'TimeoutError' ? 'Connection timed out (10s)' : err.message
      };
    }
  }

  return { success: false, provider, error: `Unknown provider '${provider}'` };
}

export async function callActiveLLM({ systemPrompt, userPrompt, jsonMode = false }) {
  const provider = llmConfig.active_provider;

  if (provider === 'azure' && llmConfig.azure.api_key && llmConfig.azure.endpoint) {
    const url = buildAzureUrl(llmConfig.azure.endpoint, llmConfig.azure.deployment, llmConfig.azure.api_version);
    const bodyPayload = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2
    };
    if (jsonMode) {
      bodyPayload.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': llmConfig.azure.api_key
      },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(18000)
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      return { content, model: `Azure OpenAI (${llmConfig.azure.deployment})` };
    }
  }

  if (provider === 'gemini' && llmConfig.gemini.api_key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${llmConfig.gemini.model}:generateContent?key=${llmConfig.gemini.api_key}`;
    const bodyPayload = {
      contents: [{ parts: [{ text: `${systemPrompt}\n\nUSER PROMPT:\n${userPrompt}` }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: jsonMode ? 'application/json' : 'text/plain'
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(18000)
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { content, model: `Google Gemini (${llmConfig.gemini.model})` };
    }
  }

  return null;
}
