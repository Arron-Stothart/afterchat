from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from typing import Any
import json
from core.agent.loop import sampling_loop, APIProvider
from anthropic.types.beta import BetaContentBlockParam
from core.tools import ToolResult

app = FastAPI()

# Configure CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    try:
        while True:
            # Receive the initial message configuration
            data = await websocket.receive_text()
            config = json.loads(data)
            
            # Callbacks to send data back to the frontend
            async def output_callback(content: BetaContentBlockParam):
                await websocket.send_json({
                    "type": "content",
                    "data": content
                })
            
            async def tool_output_callback(result: ToolResult, tool_use_id: str):
                await websocket.send_json({
                    "type": "tool_result",
                    "data": {
                        "result": {
                            "output": result.output,
                            "error": result.error,
                            "system": result.system,
                            "base64_image": result.base64_image
                        },
                        "tool_use_id": tool_use_id
                    }
                })
            
            async def api_response_callback(request: Any, response: Any, error: Exception | None):
                error_str = str(error) if error else None
                if hasattr(request, 'url'):
                    # Include request details if available
                    await websocket.send_json({
                        "type": "api_response",
                        "data": {
                            "error": error_str,
                            "request_url": str(request.url),
                            "request_method": request.method
                        }
                    })
                else:
                    await websocket.send_json({
                        "type": "api_response",
                        "data": {
                            "error": error_str
                        }
                    })

            # Run the sampling loop
            messages = await sampling_loop(
                model=config.get("model", "claude-3-5-sonnet-20241022"),
                provider=APIProvider(config.get("provider", "anthropic")),
                system_prompt_suffix=config.get("system_prompt_suffix", ""),
                messages=config["messages"],
                output_callback=output_callback,
                tool_output_callback=tool_output_callback,
                api_response_callback=api_response_callback,
                api_key=config["api_key"],
                only_n_most_recent_images=config.get("only_n_most_recent_images"),
                max_tokens=config.get("max_tokens", 4096)
            )
            
            # Send the final messages back
            await websocket.send_json({
                "type": "complete",
                "data": messages
            })
            
    except Exception as e:
        await websocket.send_json({
            "type": "error",
            "data": str(e)
        })
    finally:
        await websocket.close()

@app.get("/health")
async def health_check():
    return {"status": "ok"}
