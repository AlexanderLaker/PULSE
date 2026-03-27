"""Reddit API integration — consumer sentiment and discussions.

FREE API via PRAW (Python Reddit API Wrapper). No financial cost.
Monitor: r/SkincareAddiction, r/HaircareScience, r/sustainability, r/beauty, etc.
"""

import logging
import os
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

try:
    import praw
except ImportError:
    praw = None
    logger.warning("praw not installed. Install with: pip install praw")


class RedditClient:
    """Client for Reddit API via PRAW.

    Monitors consumer sentiment and discussions in FMCG subreddits:
    - r/SkincareAddiction: skincare trends and preferences
    - r/HaircareScience: hair care discussions
    - r/sustainability: green products interest
    - r/beauty: general beauty trends
    - r/mensfashion: men's grooming
    """

    TARGET_SUBREDDITS = [
        "SkincareAddiction",
        "HaircareScience",
        "sustainability",
        "beauty",
        "Skincare_Addiction",
        "mensfashion",
    ]

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        user_agent: str = "PULSE-TrendScanner/1.0",
    ):
        """Initialize Reddit client.

        Args:
            client_id: Reddit app client ID. If None, reads from REDDIT_CLIENT_ID env var.
            client_secret: Reddit app secret. If None, reads from REDDIT_CLIENT_SECRET.
            user_agent: User agent string for API requests
        """
        self.client_id = client_id or os.getenv("REDDIT_CLIENT_ID")
        self.client_secret = client_secret or os.getenv("REDDIT_CLIENT_SECRET")
        self.user_agent = user_agent

        if praw and self.client_id and self.client_secret:
            try:
                self.reddit = praw.Reddit(
                    client_id=self.client_id,
                    client_secret=self.client_secret,
                    user_agent=self.user_agent,
                )
            except Exception as e:
                logger.warning(f"Reddit auth failed: {e}")
                self.reddit = None
        else:
            logger.warning("Reddit credentials not available or praw not installed")
            self.reddit = None

    async def search_subreddits(
        self,
        query: str,
        limit: int = 50,
        sort: str = "hot",
    ) -> List[Dict[str, Any]]:
        """Search across target subreddits for a query.

        Args:
            query: Search term
            limit: Max posts per subreddit
            sort: Sort order (hot, new, top, controversial)

        Returns:
            List of Reddit posts
        """
        if not self.reddit:
            logger.warning("Reddit client not initialized")
            return []

        results = []

        try:
            for subreddit_name in self.TARGET_SUBREDDITS:
                try:
                    subreddit = self.reddit.subreddit(subreddit_name)

                    if sort == "hot":
                        submissions = subreddit.hot(limit=limit)
                    elif sort == "new":
                        submissions = subreddit.new(limit=limit)
                    elif sort == "top":
                        submissions = subreddit.top(time_filter="week", limit=limit)
                    else:
                        submissions = subreddit.hot(limit=limit)

                    for post in submissions:
                        if query.lower() in post.title.lower() or query.lower() in post.selftext.lower():
                            results.append({
                                "source": "Reddit",
                                "subreddit": subreddit_name,
                                "title": post.title,
                                "url": post.url,
                                "created": post.created_utc,
                                "score": post.score,
                                "num_comments": post.num_comments,
                                "selftext": post.selftext[:500],
                            })

                except Exception as e:
                    logger.debug(f"Subreddit {subreddit_name} error: {e}")
                    continue

        except Exception as e:
            logger.error(f"Reddit search error: {e}")

        logger.info(f"Reddit: found {len(results)} posts matching '{query}'")
        return results

    async def get_subreddit_top_posts(
        self,
        subreddit_name: str,
        time_filter: str = "week",
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Get top posts from a specific subreddit.

        Args:
            subreddit_name: Name of subreddit (without r/)
            time_filter: Time filter (hour, day, week, month, year, all)
            limit: Max posts

        Returns:
            List of top posts
        """
        if not self.reddit:
            return []

        try:
            subreddit = self.reddit.subreddit(subreddit_name)
            submissions = subreddit.top(time_filter=time_filter, limit=limit)

            results = []
            for post in submissions:
                results.append({
                    "title": post.title,
                    "score": post.score,
                    "num_comments": post.num_comments,
                    "created": post.created_utc,
                    "url": post.url,
                })

            return results

        except Exception as e:
            logger.error(f"Get top posts error: {e}")
            return []

    async def analyze_sentiment(
        self,
        subreddit_name: str,
        limit: int = 100,
    ) -> Dict[str, Any]:
        """Analyze sentiment in a subreddit (comment analysis).

        Args:
            subreddit_name: Target subreddit
            limit: Max comments to analyze

        Returns:
            Sentiment summary
        """
        if not self.reddit:
            return {}

        try:
            subreddit = self.reddit.subreddit(subreddit_name)

            # Get top hot posts and analyze comments
            sentiments = {"positive": 0, "neutral": 0, "negative": 0}
            comment_count = 0

            for submission in subreddit.hot(limit=10):
                submission.comments.replace_more(limit=0)
                for comment in submission.comments.list()[:limit // 10]:
                    # Simple sentiment based on keywords
                    text = comment.body.lower()
                    if any(word in text for word in ["love", "great", "best", "amazing", "excellent"]):
                        sentiments["positive"] += 1
                    elif any(word in text for word in ["hate", "worst", "bad", "awful", "terrible"]):
                        sentiments["negative"] += 1
                    else:
                        sentiments["neutral"] += 1
                    comment_count += 1

            # Convert to percentages
            if comment_count > 0:
                sentiments = {k: v / comment_count for k, v in sentiments.items()}

            return {
                "subreddit": subreddit_name,
                "comments_analyzed": comment_count,
                "sentiment": sentiments,
            }

        except Exception as e:
            logger.error(f"Sentiment analysis error: {e}")
            return {}
