"""YouTube Data API integration — trend video validation.

FREE API tier. Monitor beauty, skincare, sustainability content.
"""

import logging
import os
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

try:
    from googleapiclient.discovery import build
except ImportError:
    logger.warning("google-api-python-client not installed. Install with: pip install google-api-python-client")


class YouTubeClient:
    """Client for YouTube Data API.

    Monitors video trends in beauty, skincare, sustainability:
    - View counts and growth
    - Engagement (likes, comments)
    - Topic trends
    - Influencer activity
    """

    def __init__(self, api_key: Optional[str] = None):
        """Initialize YouTube client.

        Args:
            api_key: YouTube API key. If None, reads from YOUTUBE_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("YOUTUBE_API_KEY")
        if not self.api_key:
            logger.warning("YouTube API key not set (YOUTUBE_API_KEY env var)")

        try:
            if self.api_key:
                self.youtube = build("youtube", "v3", developerKey=self.api_key)
            else:
                self.youtube = None
        except Exception as e:
            logger.warning(f"YouTube API initialization failed: {e}")
            self.youtube = None

    async def search_videos(
        self,
        query: str,
        limit: int = 50,
        order: str = "relevance",
    ) -> List[Dict[str, Any]]:
        """Search for videos matching a query.

        Args:
            query: Search term (e.g., "sustainable beauty", "skincare routine")
            limit: Max videos to return
            order: Sort order (relevance, viewCount, rating, videoCount)

        Returns:
            List of video metadata
        """
        if not self.youtube:
            logger.warning("YouTube: API not initialized")
            return []

        try:
            request = self.youtube.search().list(
                q=query,
                part="snippet",
                maxResults=min(limit, 50),
                order=order,
                type="video",
            )

            response = request.execute()
            items = response.get("items", [])

            results = []
            for item in items[:limit]:
                snippet = item.get("snippet", {})
                results.append({
                    "source": "YouTube",
                    "video_id": item.get("id", {}).get("videoId"),
                    "title": snippet.get("title"),
                    "channel": snippet.get("channelTitle"),
                    "published": snippet.get("publishedAt"),
                    "description": snippet.get("description")[:200],
                    "thumbnail": snippet.get("thumbnails", {}).get("default", {}).get("url"),
                })

            logger.info(f"YouTube: found {len(results)} videos for '{query}'")
            return results

        except Exception as e:
            logger.error(f"YouTube search error: {e}")
            return []

    async def get_video_stats(
        self,
        video_id: str,
    ) -> Dict[str, Any]:
        """Get detailed statistics for a specific video.

        Args:
            video_id: YouTube video ID

        Returns:
            Video statistics
        """
        if not self.youtube:
            return {}

        try:
            request = self.youtube.videos().list(
                part="statistics,snippet",
                id=video_id,
            )

            response = request.execute()
            items = response.get("items", [])

            if not items:
                return {}

            item = items[0]
            stats = item.get("statistics", {})
            snippet = item.get("snippet", {})

            return {
                "video_id": video_id,
                "title": snippet.get("title"),
                "channel": snippet.get("channelTitle"),
                "view_count": int(stats.get("viewCount", 0)),
                "like_count": int(stats.get("likeCount", 0)),
                "comment_count": int(stats.get("commentCount", 0)),
                "engagement_rate": self._calculate_engagement(stats),
            }

        except Exception as e:
            logger.error(f"Get video stats error: {e}")
            return {}

    async def get_channel_videos(
        self,
        channel_id: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Get recent videos from a specific channel.

        Args:
            channel_id: YouTube channel ID
            limit: Max videos

        Returns:
            List of videos from channel
        """
        if not self.youtube:
            return []

        try:
            # Get uploads playlist
            request = self.youtube.channels().list(
                part="contentDetails",
                id=channel_id,
            )

            response = request.execute()
            items = response.get("items", [])

            if not items:
                return []

            uploads_id = items[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")

            if not uploads_id:
                return []

            # Get videos from uploads playlist
            request = self.youtube.playlistItems().list(
                part="snippet",
                playlistId=uploads_id,
                maxResults=min(limit, 50),
            )

            response = request.execute()
            items = response.get("items", [])

            results = []
            for item in items[:limit]:
                snippet = item.get("snippet", {})
                results.append({
                    "video_id": snippet.get("resourceId", {}).get("videoId"),
                    "title": snippet.get("title"),
                    "published": snippet.get("publishedAt"),
                })

            return results

        except Exception as e:
            logger.error(f"Get channel videos error: {e}")
            return []

    def _calculate_engagement(self, stats: Dict[str, Any]) -> float:
        """Calculate engagement rate (likes + comments / views).

        Args:
            stats: Video statistics dict

        Returns:
            Engagement rate as percentage
        """
        try:
            views = int(stats.get("viewCount", 0))
            likes = int(stats.get("likeCount", 0))
            comments = int(stats.get("commentCount", 0))

            if views == 0:
                return 0.0

            engagement = ((likes + comments) / views) * 100
            return min(engagement, 100.0)  # Cap at 100%

        except:
            return 0.0
