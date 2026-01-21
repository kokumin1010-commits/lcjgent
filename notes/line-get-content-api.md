# LINE Messaging API - Get Content

## Endpoint
```
GET https://api-data.line.me/v2/bot/message/{messageId}/content
```

**Note:** This domain name (api-data.line.me) is different from other endpoints (api.line.me).

## Description
Gets images, videos, audio, and files sent by users using message IDs received via the webhook.

## Requirements
- This endpoint is only available if the `contentProvider.type` property of webhook event objects is `line`.

## Headers
- Authorization: Bearer {channel access token}

## Response
- Returns binary data of the content
- Content-Type header indicates the media type

## For Video/Audio
When a user sends a large video or audio file, it may take some time until the preparation to get the binary data of the content is completed. If you try to get the content while the binary data is being prepared, the status code 202 will be returned and you can't get the binary data.

Use the transcoding status endpoint to check if the content is ready:
```
GET https://api-data.line.me/v2/bot/message/{messageId}/content/transcoding
```

## Preview Image
Get a preview image of the image or video:
```
GET https://api-data.line.me/v2/bot/message/{messageId}/content/preview
```
