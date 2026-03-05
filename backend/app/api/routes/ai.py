import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
SYSTEM_PROMPT = (
    "You are a nutrition expert. Analyze the food in this image and return ONLY valid JSON "
    "(no markdown) in this exact format: "
    '{ "dish": "name", "totalCalories": 450, "confidence": "medium", '
    '"items": [{ "name": "chicken breast", "amount": "150g", "calories": 165 }], '
    '"macros": { "protein": 35, "carbs": 40, "fat": 12 }, "tip": "short health tip" }'
)


class FoodAnalyzeRequest(BaseModel):
    api_key: str
    image_base64: str
    media_type: str = "image/jpeg"


@router.post("/analyze-food")
async def analyze_food(request: FoodAnalyzeRequest):
    payload = {
        "model": "claude-sonnet-4-6",
        "max_tokens": 1024,
        "system": SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": request.media_type,
                            "data": request.image_base64,
                        },
                    },
                    {"type": "text", "text": "Analyze this food image."},
                ],
            }
        ],
    }
    headers = {
        "x-api-key": request.api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(ANTHROPIC_API_URL, headers=headers, json=payload)
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Failed to reach Anthropic API: {exc}")

    if not response.is_success:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    return {"result": data["content"][0]["text"]}
