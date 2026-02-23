#!/usr/bin/env python3
"""Compute a route matrix for multi-stop planning with strict minimal fields.

Inputs are expected as lists compatible with Google Routes API route matrix format.
"""

import os
import requests

URL = "https://routes.googleapis.com/v1/computeRouteMatrix"


def run(origins, destinations, mode="DRIVE", traffic_aware=False):
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_MAPS_API_KEY is not set")

    headers = {
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters",
    }

    data = {
        "origins": origins,
        "destinations": destinations,
        "travelMode": mode,
    }

    if traffic_aware:
        data["routingPreference"] = "TRAFFIC_AWARE"

    response = requests.post(URL, json=data, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()
