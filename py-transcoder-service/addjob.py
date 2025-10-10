from bullmq import Queue
import asyncio
import os 

REDIS_URL = os.getenv("REDIS_URL", "rediss://red-d3ekec95pdvs739abt7g:OwK0jENZYfGKubQLIniJFvOTSZ3nPCdp@oregon-keyvalue.render.com:6379")

videoQueue = Queue("video-processing",{
    "connection": REDIS_URL
})

async def main():
    job = await videoQueue.add('process-video', { "key":"uploads/1760075556108_Big_Buck_Bunny_1080_10s_1MB.mp4", "videoId":"TEST1" })
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Worker shutting down...")