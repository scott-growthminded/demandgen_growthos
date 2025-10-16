// Storage interface for BLVD API testing tool and booking widget
import { BookingCart, InsertBookingCart, WaitlistRequest, InsertWaitlistRequest } from "@shared/schema";

export interface IStorage {
  // Booking Cart operations
  createBookingCart(cart: InsertBookingCart): Promise<BookingCart>;
  getBookingCart(cartId: string): Promise<BookingCart | null>;
  updateBookingCart(cartId: string, updates: Partial<BookingCart>): Promise<BookingCart | null>;
  deleteBookingCart(cartId: string): Promise<boolean>;
  
  // Waitlist operations
  createWaitlistRequest(request: InsertWaitlistRequest): Promise<WaitlistRequest>;
  getWaitlistRequest(id: string): Promise<WaitlistRequest | null>;
  updateWaitlistRequest(id: string, updates: Partial<WaitlistRequest>): Promise<WaitlistRequest | null>;
  getAllWaitlistRequests(): Promise<WaitlistRequest[]>;
}

export class MemStorage implements IStorage {
  private bookingCarts: Map<string, BookingCart> = new Map();
  private waitlistRequests: Map<string, WaitlistRequest> = new Map();

  // Booking Cart operations
  async createBookingCart(cart: InsertBookingCart): Promise<BookingCart> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newCart: BookingCart = {
      id,
      ...cart,
      createdAt: now,
    };
    this.bookingCarts.set(cart.cartId, newCart);
    return newCart;
  }

  async getBookingCart(cartId: string): Promise<BookingCart | null> {
    return this.bookingCarts.get(cartId) || null;
  }

  async updateBookingCart(cartId: string, updates: Partial<BookingCart>): Promise<BookingCart | null> {
    const existing = this.bookingCarts.get(cartId);
    if (!existing) return null;
    
    const updated = { ...existing, ...updates };
    this.bookingCarts.set(cartId, updated);
    return updated;
  }

  async deleteBookingCart(cartId: string): Promise<boolean> {
    return this.bookingCarts.delete(cartId);
  }

  // Waitlist operations
  async createWaitlistRequest(request: InsertWaitlistRequest): Promise<WaitlistRequest> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const newRequest: WaitlistRequest = {
      id,
      ...request,
      createdAt: now,
    };
    this.waitlistRequests.set(id, newRequest);
    return newRequest;
  }

  async getWaitlistRequest(id: string): Promise<WaitlistRequest | null> {
    return this.waitlistRequests.get(id) || null;
  }

  async updateWaitlistRequest(id: string, updates: Partial<WaitlistRequest>): Promise<WaitlistRequest | null> {
    const existing = this.waitlistRequests.get(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...updates };
    this.waitlistRequests.set(id, updated);
    return updated;
  }

  async getAllWaitlistRequests(): Promise<WaitlistRequest[]> {
    return Array.from(this.waitlistRequests.values());
  }
}

export const storage = new MemStorage();
