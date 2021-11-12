export interface TweetItem {
  id: string;
  text: string;
  sent: Boolean;
  createdAt: string;
}

enum Boolean {
  False = 0,
  True = 1,
}