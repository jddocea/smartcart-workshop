export type Category = 'audio' | 'kitchen' | 'home' | 'fitness' | 'accessories';

export interface Product {
  id: string;
  name: string;
  description: string;
  category: Category;
  price: number;
  emoji: string;
  rating: number;
  tags: string[];
}
