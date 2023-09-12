import OpenAI from 'openai';
import {failed } from '../errorable';
import { getOpenAIConfig } from '../config';
import * as vscode from 'vscode';

export async function openaiHelper() {

  const openaiConfig = getOpenAIConfig();
  
  if (failed(openaiConfig)) {
    vscode.window.showInformationMessage(openaiConfig.error);
    console.log(openaiConfig.error);
    return
  } 

  const openai = new OpenAI({
    apiKey: openaiConfig.result.apiKey
  });

  const teststream = await openai.chat.completions.create({ messages: [{ role: 'user', content: 'How can I list all files in a directory using Python?' }], model: 'gpt-3.5-turbo', stream: true }, {
    timeout: 5 * 1000,
  });

  for await (const part of teststream) {
    process.stdout.write(part.choices[0]?.delta?.content || '');
  }

  console.log(teststream);
}
