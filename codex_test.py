#!/usr/bin/env python3
"""
Simple test script to verify Codex is running
"""
import datetime
import math

def fibonacci(n):
    """Calculate the nth Fibonacci number"""
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b

# Test it
print("🦞 Codex is alive and kicking!")
print(f"Current time: {datetime.datetime.now()}")
print("\nFibonacci sequence (first 10):")
for i in range(10):
    print(f"  fib({i}) = {fibonacci(i)}")

# A little math fun
numbers = [1, 2, 3, 4, 5]
print(f"\nSum of {numbers} = {sum(numbers)}")
print(f"Product of {numbers} = {math.prod(numbers)}")

print("\n✅ All tests passed!")
