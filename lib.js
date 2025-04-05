const { spawn } = require('child_process');
const { exec } = require('child_process');

const path = require('path');
const fs = require('fs');
const https = require('https');
const axios = require('axios');
const FormData = require('form-data');
const dotenv = require('dotenv');
dotenv.config();


const sendMessageInChunks = async (ctx, message) => {
    const maxChunkSize = 1500;
    const chunks = splitMessage(message, maxChunkSize);
    for (const chunk of chunks) {
        await ctx.replyWithMarkdown(chunk);
    }
};

const splitMessage = (message, maxChunkSize) => {
    const chunks = [];
    let startIdx = 0;
    while (startIdx < message.length) {
        let endIdx = Math.min(startIdx + maxChunkSize, message.length);
        if (endIdx < message.length) {
            const lastSentenceEnd = message.lastIndexOf('.', endIdx);
            const lastWordEnd = message.lastIndexOf(' ', endIdx);
            if (lastSentenceEnd > startIdx) {
                endIdx = lastSentenceEnd + 1;
            } else if (lastWordEnd > startIdx) {
                endIdx = lastWordEnd;
            }
        }
        chunks.push(message.slice(startIdx, endIdx));
        startIdx = endIdx;
    }
    return chunks;
};

function reduceBitrate(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const args = ['-i', inputPath, '-b:a', '64k', outputPath];
        const ffmpegProcess = spawn('ffmpeg', args);

        let stderr = '';
        ffmpegProcess.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffmpegProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`ffmpeg process exited with code ${code}`);
                console.error(`Error: ${stderr}`);
                return reject(new Error(stderr));
            }
            resolve(outputPath);
        });

        ffmpegProcess.on('error', (error) => {
            console.error(`Error: ${error.message}`);
            reject(error);
        });
    });
}
async function transcribeAudio(filePath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', 'gpt-4o-transcribe');

    try {
        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_KEY}`,
                ...form.getHeaders(),
            },
        });
    
        const result = response.data;
        return result.text || Promise.reject('⛔️ No text');
    } catch (error) {
        console.error('⛔️ err:', error)
        throw error;        
    }    
}

async function transcribeAudioGROQ(filePath) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('model', 'whisper-large-v3');
    form.append('language', 'ru');

    try {
        const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                ...form.getHeaders(),
            },
        });

        const result = response.data;
        return result.text || Promise.reject('⛔️ No text');
    } catch (error) {
        console.error('⛔️ err:', error);
        throw error;
    }
}

async function downloadFile(url, filePath) {
    const file = fs.createWriteStream(filePath);
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            response.pipe(file);
            file.on('finish', resolve);
            file.on('error', reject);
        });
    });
}

async function convertFile(inputPath) {
    const fileBaseName = path.basename(inputPath, path.extname(inputPath));
    const newFileName = `${fileBaseName}-${Date.now()}.mp3`;
    const outputPath = path.join(path.dirname(inputPath), newFileName);

    await reduceBitrate(inputPath, outputPath);
    return outputPath;
}

async function prepareAudio(ctx) {
    const fileId = ctx.message.voice.file_id;
    console.log('fileId:', fileId)
    const fileLink = await ctx.telegram.getFileLink(fileId);
    console.log('filelink:', fileLink.href)
    const name = `data/${fileLink.href.split('/').pop()}`;
    await downloadFile(fileLink, name);
    return convertFile(name);
}

async function voiceHandler(ctx, bot) {
    try {
        const outputPath = await prepareAudio(ctx);
        console.log('outputPath:::', outputPath)
        const recognizedText = await transcribeAudio(outputPath);
        console.log('recognizedText:::', recognizedText)

        sendMessageInChunks(ctx, recognizedText);
    } catch (err) {
        console.log('⛔️ err:', err)
        ctx.replyWithMarkdown(`⛔️ *Error*\n${JSON.stringify(err)}`);
    }
}


module.exports = { voiceHandler };
