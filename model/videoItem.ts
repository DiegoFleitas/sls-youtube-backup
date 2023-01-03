export interface VideoItem {
  id: string;
  title: string;
  backedUp: Boolean;
  createdAt: string;
}

enum Boolean {
  False = 0,
  True = 1,
}
