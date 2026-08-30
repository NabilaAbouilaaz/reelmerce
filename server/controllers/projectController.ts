import {Request, Response } from 'express'
import * as Sentry from "@sentry/node";
import { prisma } from '../server.js';
import {v2 as cloudinary} from 'cloudinary'
import fal from '../configs/fal.js';
import sharp from 'sharp';

// While there's no paid AI provider set up yet, MOCK_GENERATION=true in .env
// makes generation instant and free by reusing existing media instead of
// calling a real model. Set it to false (or remove it) once fal.ai credits
// are added, and real generation takes over automatically.
const MOCK_GENERATION = process.env.MOCK_GENERATION === 'true';

export const createProject = async (req:Request, res: Response) => {
    let tempProjectId: string;
    const { userId } = req.auth();
    let isCreditDeducted = false;

const {name = 'New Project', aspectRatio, userPrompt, productName, productDescription, targetLength = 5} = req.body;

const images: any = req.files;
if(images.length < 2 || !productName){
    return res.status(400).json({message: 'Please upload at least 2 images'})
}

const user = await prisma.user.findUnique({
    where: {id: userId}
})

if(!user || user.credits < 5){
    return res.status(401).json({message: 'Insufficient credits'})
}else{
    // deduct credits for image generation
    await prisma.user.update({
        where: {id: userId},
        data: {credits: {decrement: 5}}
    }).then(()=>{isCreditDeducted = true})
}
    try {
        let uploadedImages = await Promise.all(
    images.map(async (item: any) => {
        let result = await cloudinary.uploader.upload(item.path, 
            {resource_type: 'image'});
        return result.secure_url;
    })
)

const project = await prisma.project.create({
    data: {
        name,
        userId,
        productName,
        productDescription,
        userPrompt,
        aspectRatio,
        targetLength: parseInt(targetLength),
        uploadedImages,
        isGenerating:true
    }
})
 tempProjectId = project.id;

const prompt = `Create a realistic UGC-style vertical photo of the person holding the product, framed for a social media reel.
    The person faces the camera directly with a natural, friendly expression and a relaxed, lightly smiling mouth.
    They hold the product up around chest or shoulder height with the label clearly facing the camera.
    Their hands must NOT cover or touch their face or mouth.
    Casual, authentic, everyday setting with soft natural daylight, as if shot on a modern smartphone.
    True-to-life skin with visible texture and pores, no plastic smoothing, no heavy retouching, no glossy studio-ad look.
    Match lighting, shadows, scale and perspective between the person and the product.
    ${userPrompt}`

// Generate the image using fal.ai (Nano Banana Pro) — or a free instant
// stand-in while MOCK_GENERATION is on (see note above).
let generatedImageUrl: string | undefined;
if (MOCK_GENERATION) {
    // No paid AI provider yet: locally composite the product photo onto the
    // model photo (product image inset in a corner) so the "result" looks
    // like a combined shot instead of just an untouched upload.
    const [w, h] = aspectRatio === '16:9' ? [1920, 1080] : [1080, 1920];

    const modelBuffer = await sharp(images[1].path)
        .resize(w, h, { fit: 'cover' })
        .toBuffer();

    const productInset = await sharp(images[0].path)
        .resize(Math.round(w * 0.32))
        .extend({ top: 8, bottom: 8, left: 8, right: 8, background: '#ffffff' })
        .toBuffer();

    const compositeBuffer = await sharp(modelBuffer)
        .composite([{ input: productInset, gravity: 'southeast' }])
        .png()
        .toBuffer();

    generatedImageUrl = `data:image/png;base64,${compositeBuffer.toString('base64')}`;
} else {
    const result = await fal.subscribe('fal-ai/nano-banana-pro/edit', {
        input: {
            prompt,
            image_urls: uploadedImages,
            aspect_ratio: aspectRatio || '9:16',
            safety_tolerance: '6' as const,
        },
    })
    generatedImageUrl = result?.data?.images?.[0]?.url;
}
if (!generatedImageUrl) {
    throw new Error('Failed to generate image');
}

const uploadResult = await cloudinary.uploader.upload(generatedImageUrl, {resource_type: 'image'});

await prisma.project.update({
    where: {id: project.id},
    data: {
        generatedImage: uploadResult.secure_url,
        isGenerating: false
    }
})
res.json({projectId:project.id})
 } catch (error:any) {
        if (tempProjectId!) {
    // update project status and error message
    await prisma.project.update({
        where: {id: tempProjectId},
        data: {isGenerating: false, error: error.message}
    })
}

if (isCreditDeducted) {
    // add credits back
    await prisma.user.update({
        where: {id: userId},
        data: {credits: {increment: 5}}
    })
}
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}
// Map the model's apparent gender to an ElevenLabs voice for the voiceover.
const VOICE_BY_GENDER: Record<string, string> = { male: 'Brian', female: 'Sarah' };

export const createVideo = async (req:Request, res: Response) => {
    const {userId} = req.auth()
    const { projectId } = req.body;
    let isCreditDeducted = false;

    try {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user || user.credits < 10) {
            return res.status(401).json({ message: 'Insufficient credits' });
        }

        const project = await prisma.project.findUnique({ where: { id: projectId, userId } })
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        if (project.isGenerating) {
            return res.status(409).json({ message: 'Generation already in progress' });
        }
        if (project.generatedVideo) {
            return res.status(409).json({ message: 'Video already generated' });
        }
        if (!project.generatedImage) {
            return res.status(400).json({ message: 'Generate the image first' });
        }

        // Deduct credits only once we know the request is valid and about to run,
        // so the early returns above can't silently burn credits.
        await prisma.user.update({
            where: { id: userId },
            data: { credits: { decrement: 10 } },
        })
        isCreditDeducted = true;

        await prisma.project.update({
            where: { id: projectId },
            data: { isGenerating: true, error: '' },
        })

        let finalVideoUrl: string | undefined;

        if (MOCK_GENERATION) {
            finalVideoUrl = 'https://www.w3schools.com/html/mov_bbb.mp4';
        } else {
            const aspectRatio = project.aspectRatio === '16:9' ? '16:9' : '9:16';

            // 1. Look at the generated image: read the model's apparent gender
            //    (to pick a matching voice) and write a short spoken ad line,
            //    both in a single vision call.
            const visionResult = await fal.subscribe('fal-ai/any-llm/vision', {
                input: {
                    model: 'google/gemini-2.5-flash-lite',
                    image_urls: [project.generatedImage],
                    prompt: `You are scripting a casual Instagram/TikTok reel where a creator talks to camera about a product. The product is "${project.productName}"${project.productDescription ? `. Product details: ${project.productDescription}` : ''}.${project.userPrompt ? ` Creative direction: ${project.userPrompt}.` : ''}
Look at the person in the image, then respond with ONLY a JSON object — no markdown, no commentary:
{"gender": "male" | "female", "script": "<what the creator says straight to camera: a strong hook in the first 4 words, casual spoken tone (contractions, no corporate phrasing), one clear benefit, max 15 words, about 5 seconds spoken, no stage directions or emojis>"}`,
                },
            })

            const raw = String(visionResult?.data?.output ?? '').trim();
            let gender = 'female';
            let script = `${project.productName}. ${project.productDescription}`.trim();
            try {
                const parsed = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
                const g = String(parsed?.gender ?? '').toLowerCase();
                gender = g.includes('female') ? 'female' : g.includes('male') ? 'male' : gender;
                if (parsed?.script) script = String(parsed.script).trim();
            } catch {
                // fall back to the templated script / default voice
            }
            // Hard cap so the voiceover can't overrun the ~5s clip.
            script = script.split(/\s+/).filter(Boolean).slice(0, 18).join(' ');
            if (!script) script = `Meet ${project.productName}. You're going to love this.`;

            const voice = VOICE_BY_GENDER[gender] ?? VOICE_BY_GENDER.female;

            // 2. Voiceover in the gender-matched voice.
            const ttsResult = await fal.subscribe('fal-ai/elevenlabs/tts/multilingual-v2', {
                input: { text: script, voice },
            })
            const audioUrl = ttsResult?.data?.audio?.url;
            if (!audioUrl) throw new Error('Failed to generate voiceover audio');

            // 3. Silent selfie-style "talking to camera" reel at the project's
            //    aspect ratio (Seedance has an explicit aspect_ratio param,
            //    unlike Kling/Veo; Veo also hard-blocks recognizable real people).
            //    Seedance Lite @ 720p / 5s keeps the fal.ai spend down.
            //    Keep the mouth unobstructed so the lip-sync pass has a clean face.
            const videoPrompt = `Vertical selfie-style UGC reel. The person talks directly to the camera with natural facial expressions and small hand gestures, occasionally holding up ${project.productName}${project.productDescription ? ` (${project.productDescription})` : ''}. Hands stay around chest height and never cover or touch the mouth or face. Handheld camera with subtle natural movement, casual real-world lighting, authentic and energetic, not a polished studio ad.`
            const videoResult = await fal.subscribe('fal-ai/bytedance/seedance/v1/lite/image-to-video', {
                input: {
                    prompt: videoPrompt,
                    image_url: project.generatedImage,
                    aspect_ratio: aspectRatio,
                    duration: '5',
                    resolution: '720p',
                },
            })
            const silentVideoUrl = videoResult?.data?.video?.url;
            if (!silentVideoUrl) throw new Error('Failed to generate video');

            // 4. Lip-sync the voiceover onto the video. The output already has
            //    the audio track baked in. (installed @fal-ai/client ships stale
            //    model enums for this endpoint; lipsync-2 is current per the API.)
            const lipsyncResult = await fal.subscribe('fal-ai/sync-lipsync/v2', {
                input: {
                    video_url: silentVideoUrl,
                    audio_url: audioUrl,
                    model: 'lipsync-2' as any,
                    sync_mode: 'remap',
                },
            })
            finalVideoUrl = lipsyncResult?.data?.video?.url;
        }

        if (!finalVideoUrl) {
            throw new Error('Failed to generate video');
        }

        const uploadResult = await cloudinary.uploader.upload(finalVideoUrl, { resource_type: 'video' });

        await prisma.project.update({
            where: { id: projectId },
            data: { generatedVideo: uploadResult.secure_url, isGenerating: false },
        })

        res.json({ message: 'Video generation completed', videoUrl: uploadResult.secure_url })

    } catch (error:any) {
        // fal.ai puts the real reason (e.g. safety-filter rejection, invalid
        // input) on error.body.detail, not error.message — pull it out so we
        // don't just surface a bare "Unprocessable Entity".
        let detailMessage = error.message;
        const detail = error?.body?.detail;
        if (Array.isArray(detail)) {
            detailMessage = detail.map((d: any) => d?.msg || JSON.stringify(d)).join('; ');
        } else if (typeof detail === 'string') {
            detailMessage = detail;
        }
        if (error?.status) {
            detailMessage = `fal.ai ${error.status}: ${detailMessage}`;
        }
        console.error('createVideo failed:', error?.status, error?.body ?? error);

        // updateMany so a bad projectId here can't throw inside the catch
        await prisma.project.updateMany({
            where: { id: projectId, userId },
            data: { isGenerating: false, error: detailMessage },
        })

        if (isCreditDeducted) {
            // refund the credits we deducted
            await prisma.user.update({
                where: { id: userId },
                data: { credits: { increment: 10 } },
            })
        }

        Sentry.captureException(error);
        res.status(500).json({ message: detailMessage });
    }
}

export const getAllPublishedProjects = async (req:Request, res: Response) => {
    try {
    const projects = await prisma.project.findMany({
        where: {isPublished: true}
    })
    res.json({projects})

} catch (error: any) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}
export const deleteProject = async (req:Request, res: Response) => {
    try {
const { userId } = req.auth();
const { projectId } = req.params;

const project = await prisma.project.findUnique({
    where: {id: projectId, userId}
})

if (!project) {
    return res.status(404).json({ message: 'Project not found' });
}
await prisma.project.delete({
    where: {id: projectId}
})

res.json({ message: 'Project deleted' });
    } catch (error:any) {
        Sentry.captureException(error);
        res.status(500).json({ message: error.message });
    }
}