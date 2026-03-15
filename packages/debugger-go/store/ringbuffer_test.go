package store

import (
	"testing"
)

func TestRingBuffer_PushAndToSlice(t *testing.T) {
	rb := NewRingBuffer[int](5)

	rb.Push(1)
	rb.Push(2)
	rb.Push(3)

	got := rb.ToSlice()
	want := []int{1, 2, 3}

	if len(got) != len(want) {
		t.Fatalf("expected len %d, got %d", len(want), len(got))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("index %d: expected %d, got %d", i, want[i], got[i])
		}
	}
}

func TestRingBuffer_OverflowEviction(t *testing.T) {
	rb := NewRingBuffer[int](3)

	// Push 5 items into a buffer of capacity 3.
	for i := 1; i <= 5; i++ {
		rb.Push(i)
	}

	got := rb.ToSlice()
	// Should contain the last 3 items: 3, 4, 5
	want := []int{3, 4, 5}

	if len(got) != len(want) {
		t.Fatalf("expected len %d, got %d", len(want), len(got))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("index %d: expected %d, got %d", i, want[i], got[i])
		}
	}

	if rb.Len() != 3 {
		t.Errorf("expected len 3, got %d", rb.Len())
	}
}

func TestRingBuffer_Filter(t *testing.T) {
	rb := NewRingBuffer[int](10)
	for i := 1; i <= 10; i++ {
		rb.Push(i)
	}

	// Filter even numbers.
	evens := rb.Filter(func(n int) bool { return n%2 == 0 })
	want := []int{2, 4, 6, 8, 10}

	if len(evens) != len(want) {
		t.Fatalf("expected %d evens, got %d", len(want), len(evens))
	}
	for i := range want {
		if evens[i] != want[i] {
			t.Errorf("index %d: expected %d, got %d", i, want[i], evens[i])
		}
	}
}

func TestRingBuffer_FilterAfterOverflow(t *testing.T) {
	rb := NewRingBuffer[int](3)
	for i := 1; i <= 6; i++ {
		rb.Push(i)
	}

	// Buffer contains [4, 5, 6]. Filter for > 4.
	got := rb.Filter(func(n int) bool { return n > 4 })
	want := []int{5, 6}

	if len(got) != len(want) {
		t.Fatalf("expected %d items, got %d", len(want), len(got))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("index %d: expected %d, got %d", i, want[i], got[i])
		}
	}
}

func TestRingBuffer_Clear(t *testing.T) {
	rb := NewRingBuffer[string](5)
	rb.Push("a")
	rb.Push("b")
	rb.Push("c")

	rb.Clear()

	if rb.Len() != 0 {
		t.Errorf("expected len 0 after clear, got %d", rb.Len())
	}

	got := rb.ToSlice()
	if len(got) != 0 {
		t.Errorf("expected empty slice after clear, got %v", got)
	}

	// Push after clear should work normally.
	rb.Push("d")
	got = rb.ToSlice()
	if len(got) != 1 || got[0] != "d" {
		t.Errorf("expected [d] after push-after-clear, got %v", got)
	}
}

func TestRingBuffer_EmptySlice(t *testing.T) {
	rb := NewRingBuffer[int](5)
	got := rb.ToSlice()
	if len(got) != 0 {
		t.Errorf("expected empty slice, got %v", got)
	}
}

func TestRingBuffer_Len(t *testing.T) {
	rb := NewRingBuffer[int](3)

	if rb.Len() != 0 {
		t.Errorf("expected 0, got %d", rb.Len())
	}

	rb.Push(1)
	if rb.Len() != 1 {
		t.Errorf("expected 1, got %d", rb.Len())
	}

	rb.Push(2)
	rb.Push(3)
	if rb.Len() != 3 {
		t.Errorf("expected 3, got %d", rb.Len())
	}

	// Overflow should not increase len beyond capacity.
	rb.Push(4)
	if rb.Len() != 3 {
		t.Errorf("expected 3 after overflow, got %d", rb.Len())
	}
}
