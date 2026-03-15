// Package store provides thread-safe ring buffer storage for debugger log
// entries. It implements fixed-capacity buffers that overwrite the oldest
// entries when full, and a higher-level Store that manages separate buffers
// for each entry type with query/filter support.
package store

import "sync"

// RingBuffer is a generic, thread-safe, fixed-capacity circular buffer.
// When the buffer is full, the oldest element is overwritten.
type RingBuffer[T any] struct {
	buf      []T
	head     int
	size     int
	capacity int
	mu       sync.Mutex
}

// NewRingBuffer creates a RingBuffer with the given maximum capacity.
func NewRingBuffer[T any](capacity int) *RingBuffer[T] {
	return &RingBuffer[T]{
		buf:      make([]T, capacity),
		capacity: capacity,
	}
}

// Push appends an item to the buffer. If the buffer is full, the oldest
// item is overwritten.
func (r *RingBuffer[T]) Push(item T) {
	r.mu.Lock()
	defer r.mu.Unlock()

	idx := (r.head + r.size) % r.capacity
	if r.size == r.capacity {
		// Overwrite oldest — advance head
		r.buf[r.head] = item
		r.head = (r.head + 1) % r.capacity
	} else {
		r.buf[idx] = item
		r.size++
	}
}

// ToSlice returns all items in insertion order (oldest first).
func (r *RingBuffer[T]) ToSlice() []T {
	r.mu.Lock()
	defer r.mu.Unlock()

	result := make([]T, r.size)
	for i := 0; i < r.size; i++ {
		result[i] = r.buf[(r.head+i)%r.capacity]
	}
	return result
}

// Filter returns items that satisfy the predicate, in insertion order.
func (r *RingBuffer[T]) Filter(fn func(T) bool) []T {
	r.mu.Lock()
	defer r.mu.Unlock()

	var result []T
	for i := 0; i < r.size; i++ {
		item := r.buf[(r.head+i)%r.capacity]
		if fn(item) {
			result = append(result, item)
		}
	}
	return result
}

// Clear removes all items from the buffer.
func (r *RingBuffer[T]) Clear() {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.head = 0
	r.size = 0
}

// Len returns the current number of items in the buffer.
func (r *RingBuffer[T]) Len() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.size
}
