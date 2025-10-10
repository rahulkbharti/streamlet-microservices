from bullmq import Queue
import asyncio
import os 

REDIS_URL = os.getenv("REDIS_URL", "")

videoQueue = Queue("video-processing",{
    "connection": REDIS_URL
})

async def main():
    job = await videoQueue.add('process-video', { "key":"uploads/1760086080434_Restoring_the_Heart_of_Te_Fiti_-_Moana_Movie_Scene.mp4", "videoId":"xBTQGi2AhGi" })
if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Worker shutting down...")