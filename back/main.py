import time
import os
import json
import random
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, APIRouter, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from dummy_data import DUMMY_DB

# --- Pydantic Schemas for Request Bodies (matching frontend schemas) ---

class LoginRequest(BaseModel):
    username: str
    password: str

class CoreDeviceCreate(BaseModel):
    name: str
    ip: str
    coresite_id: int

class CoreSiteCreate(BaseModel):
    name: str

class NetworkCreate(BaseModel):
    name: str

class SiteDescription(BaseModel):
    description: str

class FavoriteLinksUpdate(BaseModel):
    link_ids: list = []

class LinkBase(BaseModel):
    pass # Not used in dummy backend, but kept for signature matching

# --- FastAPI App Initialization ---
app = FastAPI(title="Spiderweb Dummy Backend")

# --- CORS Middleware ---
# Allows the frontend (e.g., from http://localhost:5173, 127.0.0.1, or LAN) to communicate with the backend.
origins = [
    "http://localhost",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_private_network=True,
)

# In-memory database from our dummy data generator
db = DUMMY_DB

# --- Dummy Authentication Dependencies ---
# These functions simulate the role checkers from the original backend.
def user_role_checker(request: Request):
    # For dummy backend, we'll just return a mock user
    user = next((u for u in db["users"] if u["username"] == "userg"), None)
    if not user:
        raise HTTPException(status_code=401, detail="Mock user not found")
    return user

def admin_role_checker(request: Request):
    # For dummy backend, we'll just return a mock admin
    admin_user = next((u for u in db["users"] if u["role"] == "admin"), None)
    if not admin_user:
        raise HTTPException(status_code=401, detail="Mock admin not found")
    return admin_user


# ==============================================================================
# ALERTS ROUTES (from alerts.py)
# ==============================================================================
router_alerts = APIRouter()

# ==============================================================================
# ALERTS ROUTES (from alerts.py)
# ==============================================================================
router_alerts = APIRouter()

@router_alerts.get("/alerts")
@router_alerts.get("/get_all_alerts")
def get_alerts(last_crawl_number: Optional[int] = None):
    # Non-blocking immediate return for alerts
    return JSONResponse(
        content={"alerts": db["alerts"], "current_crawl_number": db["crawler_cycle"]["count"]},
        media_type="application/json"
    )

@router_alerts.get("/get_all_alerts_status")
def get_all_alerts_status():
    return {"status": "ok", "count": len(db["alerts"])}

@router_alerts.get("/get_all_alerts_severity")
def get_all_alerts_severity():
    return {"severities": [a.get("severityScore", 1) for a in db["alerts"]]}

# ==============================================================================
# CORE DEVICE ROUTES (from coredevice.py)
# ==============================================================================
router_coredevice = APIRouter()

@router_coredevice.get("/api/core-topology-events")
@router_coredevice.get("/api/link-status-events")
async def get_core_topology_events(
    request: Request,
    days: Optional[int] = None,
    since: Optional[str] = None,
    event_type: Optional[str] = None,
    local_device_id: Optional[int] = None,
    remote_device_id: Optional[int] = None,
    offset: Optional[int] = 0,
    include_summary: Optional[bool] = False,
    current_user: dict = Depends(user_role_checker)
):
    """Returns link status change events filtered by time window and criteria."""
    now = datetime.utcnow()

    # Support event-type alias with hyphen
    effective_event_type = request.query_params.get("event-type") or request.query_params.get("event_type") or event_type
    inc_summary = include_summary or request.query_params.get("include_summary", "").lower() == "true"
    off = offset if offset is not None else int(request.query_params.get("offset", 0))

    # Determine time window cutoff
    filter_days = days
    if filter_days is None:
        if since == "24h":
            filter_days = 1
        elif since == "7d":
            filter_days = 7
        elif since == "30d":
            filter_days = 30
        else:
            filter_days = 30  # Default to 30 days if no filter specified

    cutoff = now - timedelta(days=filter_days)

    filtered = []
    for ev in db.get("link_status_events", []):
        t_str = ev.get("created_at") or ev.get("changed_at")
        if not t_str:
            continue
        try:
            ev_dt = datetime.fromisoformat(t_str)
        except Exception:
            continue

        if ev_dt < cutoff:
            continue

        if effective_event_type:
            ev_type = ev.get("event_type")
            if ev_type != effective_event_type:
                # Treat ospf_full and ospf_recovery interchangeably for compatibility
                if not (effective_event_type in ("ospf_full", "ospf_recovery") and ev_type in ("ospf_full", "ospf_recovery")):
                    continue

        if local_device_id is not None and ev.get("local_device_id") != local_device_id:
            continue

        if remote_device_id is not None and ev.get("remote_device_id") != remote_device_id:
            continue

        filtered.append(ev)

    events_slice = filtered[off:] if off > 0 else filtered

    resp = {
        "events": events_slice,
        "count": len(filtered),
        "days": filter_days,
        "since": since or f"{filter_days}d",
    }
    if inc_summary:
        resp["summary"] = {
            "count": len(filtered),
            "total": len(filtered),
            "event_type": effective_event_type,
            "days": filter_days,
        }

    return resp

def _isoformat(dt):
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)

@router_coredevice.get("/api/core-topology")
async def get_core_topology(current_user: dict = Depends(user_role_checker)):
    """Returns the latest core-to-core link topology state."""
    devices_out = []
    for device in db["core_devices"]:
        # Find the coresite name for this device
        coresite = next((cs for cs in db["core_sites"] if cs["id"] == device["coresite_id"]), None)
        coresite_name = coresite["name"] if coresite else "Unknown"
        # Find the network name
        network_id = device.get("network_type_id", 1)
        network = next((n for n in db["networks"] if n["id"] == network_id), None)
        network_name = network["name"] if network else "Unknown"
        # Determine device status based on its links: <up | unreachable | unknown>
        device_links = [l for l in db["links"] if l["coredevice_id"] == device["id"] and l["neighbor_is_core"]]
        if not device_links:
            status = "unknown"
        elif all(l["physical_status"] == "Up" for l in device_links):
            status = "up"
        elif all(l["physical_status"] == "Down" for l in device_links):
            status = "unreachable"
        else:
            status = "up"
        # Build links list for this device
        links_out = []
        for raw_link in device_links:
            neighbor_device = next((d for d in db["core_devices"] if d["id"] == (raw_link["neighbor_coredevice_id"] if isinstance(raw_link, dict) else raw_link.neighbor_coredevice_id)), None)
            
            # Helper to support both dict and object (attribute) access
            class _LinkProxy:
                def __init__(self, src):
                    self._src = src
                def __getattr__(self, name):
                    if hasattr(self._src, name):
                        return getattr(self._src, name)
                    if isinstance(self._src, dict):
                        return self._src.get(name)
                    return None
                def __getitem__(self, key):
                    if isinstance(self._src, dict):
                        return self._src[key]
                    return getattr(self._src, key)
                def get(self, key, default=None):
                    if isinstance(self._src, dict):
                        return self._src.get(key, default)
                    return getattr(self._src, key, default)

            link = _LinkProxy(raw_link)

            cutoff_24h = datetime.utcnow() - timedelta(hours=24)
            ev_for_link = [
                e for e in db.get("link_status_events", [])
                if e.get("link_id") == link["id"]
            ]
            ev_24h = [
                e for e in ev_for_link
                if datetime.fromisoformat(e.get("created_at", e.get("changed_at"))) >= cutoff_24h
            ]
            link_drops_24h = len([e for e in ev_24h if e.get("event_type") == "link_down"])
            ospf_drops_24h = len([e for e in ev_24h if e.get("event_type") == "ospf_drop"])

            rate_val = link.ping_success_rate if link.ping_success_rate is not None else 100.0
            attempts_val = link.get("ping_ratio") or (f"{link.get('ping_packets_success')}/{link.get('ping_packets_total', 10000)}" if link.get("ping_packets_success") is not None else f"{int(round((rate_val / 100.0) * 10000))}/10000")

            links_out.append({
                "id": link["id"],
                "local_interface": link.get("local_interface") or f"GigabitEthernet0/{link['id'] % 4}",
                "local_interface_description": link.get("description", ""),
                "local_link_ip": device.get("ip") or f"10.0.{link['id'] % 250}.1",
                "remote_device_id": link["neighbor_coredevice_id"],
                "remote_device_name": neighbor_device["name"] if neighbor_device else "Unknown",
                "remote_interface": link.get("remote_interface") or f"GigabitEthernet0/{(link['id'] + 1) % 4}",
                "remote_device_ip": neighbor_device.get("ip", "") if neighbor_device else "",
                "remote_link_ip": link.get("neighbor_ip", "") or f"10.0.{link['id'] % 250}.2",
                "oper_status": link.get("physical_status", "Up"),
                "remote_oper_status": link.get("remote_oper_status", link.get("physical_status", "Up")),
                "admin_status": "Up",
                "bandwidth_mbps": link.bandwidth_mbps if link.bandwidth_mbps is not None else 10000,
                "mtu": link.mtu if link.mtu is not None else 1500,
                "ping_success_rate": rate_val,
                "ping_success_attempts": attempts_val,
                "last_ping_at": _isoformat(link.last_ping_at),
                "ospf_state": link.ospf_state or "Full",
                "is_ospf_full": str(link.ospf_state or "Full").upper() == "FULL",
                "ospf_uptime_seconds": link.get("ospf_uptime_seconds") or link.get("ospf_up_time_seconds"),
                "ospf_uptime": link.get("ospf_uptime") or link.get("ospf_up_time"),
                "ospf_up_time_seconds": link.get("ospf_uptime_seconds") or link.get("ospf_up_time_seconds"),
                "ospf_up_time": link.get("ospf_uptime") or link.get("ospf_up_time"),
                "ospf_state_duration_seconds": link.get("ospf_state_duration_seconds"),
                "ospf_state_duration": link.get("ospf_state_duration"),
                "last_up_at": link.get("last_up_at"),
                "last_down_at": link.get("last_down_at"),
                "last_ospf_down_at": link.get("last_ospf_down_at"),
                "last_ospf_full_at": link.get("last_ospf_full_at"),
                "last_seen_at": link.get("updated_at", datetime.utcnow().isoformat()),
                "last_state_change_at": link.get("status_changed_at", link.get("updated_at", datetime.utcnow().isoformat())),
                "link_drops_last_24h": link_drops_24h,
                "pim_state": link.get("pim_state", "up"),
                "is_pim_up": link.get("is_pim_up", True),
                "pim_uptime": link.get("pim_uptime", "12w5d"),
                "pim_uptime_seconds": link.get("pim_uptime_seconds", 7689600),
                "mpls_enabled": link.get("mpls_enabled", True),
                "mpls_ldp_state": link.get("mpls_ldp_state", "oper"),
                "is_mpls_up": link.get("is_mpls_up", True),
                "mpls_uptime": link.get("mpls_uptime", "12w5d"),
                "mpls_uptime_seconds": link.get("mpls_uptime_seconds", 7689600),
                "in_bps": link.get("in_bps") or link.get("input_rate"),
                "out_bps": link.get("out_bps") or link.get("output_rate"),
                "input_rate": link.get("input_rate") or link.get("in_bps"),
                "output_rate": link.get("output_rate") or link.get("out_bps"),
                # Backwards-compatibility aliases
                "local_ip": device.get("ip") or f"10.0.{link['id'] % 250}.1",
                "remote_ip": link.get("neighbor_ip", "") or f"10.0.{link['id'] % 250}.2",
                "ping_packets_success": attempts_val,
                "ping_packets_total": link.ping_packets_total if link.ping_packets_total is not None else 10000,
            })
        devices_out.append({
            "id": device["id"],
            "name": device["name"],
            "ip": device["ip"],
            "coresite_name": coresite_name,
            "network_name": network_name,
            "status": status,
            "links": links_out,
        })
    return {
        "generated_at": datetime.utcnow().isoformat(),
        "devices": devices_out,
    }

@router_coredevice.get("/get_core_devices")
@router_coredevice.get("/coredevices")
async def get_all_core_devices(current_user: dict = Depends(user_role_checker)):
    return db["core_devices"]

@router_coredevice.get("/coresite/{coresite_id}/coredevices")
async def get_core_devices_by_coresite(coresite_id: int, current_user: dict = Depends(user_role_checker)):
    devices = [d for d in db["core_devices"] if d["coresite_id"] == coresite_id]
    return devices

@router_coredevice.get("/network/{network_id}/coresite/{coresite_id}/coredevices")
async def get_coresite_coredevices_with_network(network_id: int, coresite_id: int):
    devices = [
        d for d in db["core_devices"] 
        if d["coresite_id"] == coresite_id and network_id in d.get("network_ids", [])
    ]
    return devices

@router_coredevice.post("/admin/coredevice/create/")
@router_coredevice.post("/add_core_device")
async def create_coredevice_admin(coredevice: CoreDeviceCreate, current_user: dict = Depends(admin_role_checker)):
    if any(d["name"] == coredevice.name for d in db["core_devices"]):
        raise HTTPException(status_code=400, detail="coredevice already exists.")
    
    new_id = max(d["id"] for d in db["core_devices"]) + 1 if db["core_devices"] else 1
    new_device = {
        "id": new_id,
        "name": coredevice.name,
        "hostname": coredevice.name,
        "ip": coredevice.ip,
        "ip_address": coredevice.ip,
        "coresite_id": coredevice.coresite_id,
        "core_pikudim_site_id": coredevice.coresite_id,
        "network_ids": [],
        "network_type_id": 1,
    }
    db["core_devices"].append(new_device)
    return new_device

@router_coredevice.delete("/admin/coredevice/delete/{coredevice_id}")
@router_coredevice.delete("/delete_device/{coredevice_id}")
async def delete_coredevice_admin(coredevice_id: int, current_user: dict = Depends(admin_role_checker)):
    device_to_delete = next((d for d in db["core_devices"] if d["id"] == coredevice_id), None)
    if not device_to_delete:
        raise HTTPException(status_code=404, detail='coredevice not found.')
    
    if any(coredevice_id in s.get("coredevice_ids", []) for s in db["sites"]):
         raise HTTPException(status_code=400, detail="Coredevice is associated with end-site, cannot delete")

    db["core_devices"] = [d for d in db["core_devices"] if d["id"] != coredevice_id]
    return {"message": "Coredevice deleted successfully"}


# ==============================================================================
# CORE SITE ROUTES (from coresite.py)
# ==============================================================================
router_coresite = APIRouter()

@router_coresite.get("/get_core_pikudim")
@router_coresite.get("/core_sites")
async def get_all_core_sites(current_user: dict = Depends(user_role_checker)):
    return db["core_sites"]

@router_coresite.post("/admin/coresite/create/")
@router_coresite.post("/add_core_pikudim")
async def create_coresite_admin(coresite: CoreSiteCreate, current_user: dict = Depends(admin_role_checker)):
    if any(cs["name"] == coresite.name for cs in db["core_sites"]):
        raise HTTPException(status_code=400, detail="coresite already exists.")
    
    new_id = max(cs["id"] for cs in db["core_sites"]) + 1 if db["core_sites"] else 1
    new_site = {"id": new_id, "name": coresite.name, "core_site_name": coresite.name, "network_ids": []}
    db["core_sites"].append(new_site)
    return new_site

@router_coresite.delete("/admin/coresite/delete/{coresite_id}")
@router_coresite.delete("/delete_core_pikudim/{coresite_id}")
async def delete_coresite_admin(coresite_id: int, current_user: dict = Depends(admin_role_checker)):
    site_to_delete = next((cs for cs in db["core_sites"] if cs["id"] == coresite_id), None)
    if not site_to_delete:
        raise HTTPException(status_code=404, detail='coresite not found.')

    if any(d["coresite_id"] == coresite_id for d in db["core_devices"]):
        raise HTTPException(status_code=400, detail="Coresite is associated with coredevice, cannot delete")

    db["core_sites"] = [cs for cs in db["core_sites"] if cs["id"] != coresite_id]
    return {"message": "Coresite deleted successfully"}

@router_coresite.get("/get-core-site-traffic/{coresite_id}/")
@router_coresite.get("/get-core-site-traffic/{coresite_id}")
@router_coresite.get("/api/get-core-site-traffic/{coresite_id}/")
@router_coresite.get("/api/get-core-site-traffic/{coresite_id}")
async def get_core_site_traffic(coresite_id: str):
    """
    Returns the inbound and outbound traffic for a specific core site.
    Supports query by numeric coresite ID or site name.
    """
    site_id = None
    try:
        site_id = int(coresite_id)
    except ValueError:
        site = next((cs for cs in db.get("core_sites", []) if cs["name"].lower() == coresite_id.lower() or cs.get("core_site_name", "").lower() == coresite_id.lower()), None)
        if site:
            site_id = site["id"]

    if site_id is None:
        raise HTTPException(status_code=404, detail="Core site not found")

    traffic_entry = db.get("core_site_traffic", {}).get(site_id)
    if not traffic_entry:
        total_in = round(random.uniform(15.0, 400.0), 1)
        total_out = round(random.uniform(12.0, 380.0), 1)
        traffic_entry = {
            "id": site_id,
            "traffic": {
                "in": f"{total_in} Gbps",
                "out": f"{total_out} Gbps",
            },
        }
        db.setdefault("core_site_traffic", {})[site_id] = traffic_entry
    else:
        # Subtle real-time fluctuation (+/- 0.1 to 1.5 Gbps) to simulate dynamic network telemetry on each poller refresh
        try:
            curr_in = float(str(traffic_entry["traffic"]["in"]).replace(" Gbps", "").replace("Gbps", "").strip())
            curr_out = float(str(traffic_entry["traffic"]["out"]).replace(" Gbps", "").replace("Gbps", "").strip())
            delta_in = round(random.uniform(-1.5, 1.5), 1)
            delta_out = round(random.uniform(-1.5, 1.5), 1)
            new_in = max(1.0, round(curr_in + delta_in, 1))
            new_out = max(1.0, round(curr_out + delta_out, 1))
            traffic_entry["traffic"]["in"] = f"{new_in} Gbps"
            traffic_entry["traffic"]["out"] = f"{new_out} Gbps"
        except Exception:
            pass

    return traffic_entry

# ==============================================================================
# NETWORK ROUTES (from network.py)
# ==============================================================================
router_network = APIRouter()

@router_network.get("/networks/")
@router_network.get("/get_net_types")
async def get_networks(current_user: dict = Depends(user_role_checker)):
    return db["networks"]

@router_network.get("/network/{network_id}/coresites")
async def get_network_coresites(network_id: int, current_user: dict = Depends(user_role_checker)):
    sites = [cs for cs in db["core_sites"] if network_id in cs.get("network_ids", [])]
    return [{"id": s["id"], "name": s["name"]} for s in sites]

@router_network.post("/admin/network/create/")
@router_network.post("/add_net_type")
async def create_network_admin(network: NetworkCreate, current_user: dict = Depends(admin_role_checker)):
    if any(n["name"] == network.name for n in db["networks"]):
        raise HTTPException(status_code=400, detail="network already exists.")
    
    new_id = max(n["id"] for n in db["networks"]) + 1 if db["networks"] else 1
    new_network = {"id": new_id, "name": network.name}
    db["networks"].append(new_network)
    return new_network

@router_network.delete("/admin/network/delete/{network_id}")
@router_network.delete("/delete_net_type/{network_id}")
async def delete_network_admin(network_id: int, current_user: dict = Depends(admin_role_checker)):
    if not any(n["id"] == network_id for n in db["networks"]):
         raise HTTPException(status_code=404, detail='network not found.')

    if any(network_id in cs.get("network_ids", []) for cs in db["core_sites"]) or \
       any(network_id in d.get("network_ids", []) for d in db["core_devices"]):
       raise HTTPException(status_code=400, detail="Network is associated with coresite or coredevice, cannot delete")

    db["networks"] = [n for n in db["networks"] if n["id"] != network_id]
    return {"message": "Network deleted successfully"}


# ==============================================================================
# LINK ROUTES (from link.py)
# ==============================================================================
router_link = APIRouter()

@router_link.get("/link/{link_id}")
async def get_link(link_id: int, current_user: dict = Depends(user_role_checker)):
    link = next((l for l in db["links"] if l["id"] == link_id), None)
    if link is None:
        raise HTTPException(status_code=404, detail="Link not found")
    return link

@router_link.get("/links")
def get_filtered_links(
        skip: int = 0, limit: int = 20, coredevice_id: Optional[int] = None,
        neighbor_site_id: Optional[str] = None, neighbor_coredevice_id: Optional[str] = None,
        start_date: Optional[str] = None, end_date: Optional[str] = None,
        current_user: dict = Depends(user_role_checker)):
    
    results = db["links"]
    if coredevice_id:
        results = [l for l in results if l["coredevice_id"] == coredevice_id]

    # Other filters can be added here if needed for dummy logic
    
    return results[skip : skip + limit]

@router_link.get("/coredevice/{coredevice_id}/links-to-end-sites")
def get_links_to_end_sites(coredevice_id: Optional[int] = None, current_user: dict = Depends(user_role_checker)):
    # This is a complex query, for the dummy backend we can return a subset of links
    # that are NOT core-to-core
    end_site_links = [l for l in db["links"] if l["coredevice_id"] == coredevice_id and not l["neighbor_is_core"]]
    return end_site_links

@router_link.get("/favorite-links")
async def get_favorite_links(current_user: dict = Depends(user_role_checker)):
    user_id = current_user['id']
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if user:
        user_favs = {str(x) for x in user.get("favorite_links", []) if not isinstance(x, dict)}
        return [l for l in db["links"] if str(l["id"]) in user_favs]
    return []

@router_link.post("/add-favorite-link/{link_id}")
async def add_favorite_link(link_id: int, current_user: dict = Depends(user_role_checker)):
    user_id = current_user['id']
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    link = next((l for l in db["links"] if l["id"] == link_id), None)
    if user and link:
        if link_id not in user["favorite_links"]:
            user["favorite_links"].append(link_id)
        return {"message": "Link added to favorites successfully"}
    raise HTTPException(status_code=404, detail="Link or user not found")

@router_link.delete("/delete-favorite-link/{link_id}")
async def delete_favorite_link(link_id: int, current_user: dict = Depends(user_role_checker)):
    user_id = current_user['id']
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    link = next((l for l in db["links"] if l["id"] == link_id), None)
    if user and link:
        if link_id in user["favorite_links"]:
            user["favorite_links"].remove(link_id)
        return {"message": "Link removed from favorites successfully"}
    raise HTTPException(status_code=404, detail="Link or user not found")

@router_link.put("/favorite-links")
@router_link.post("/favorite-links")
async def update_favorite_links(data: FavoriteLinksUpdate, current_user: dict = Depends(user_role_checker)):
    user_id = current_user['id']
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if user:
        user["favorite_links"] = [int(x) if str(x).isdigit() else str(x) for x in data.link_ids if not isinstance(x, dict)]
        return {"success": True, "updated_ids": user["favorite_links"]}
    return {"success": True, "updated_ids": data.link_ids}

@router_link.get("/get_ten_gig_lines")
@router_link.get("/links")
@router_link.get("/links/topology")
def get_links_with_neighbors():
    return db["links"]

@router_link.get("/link/topology/{device_id}")
async def get_device_links_topology(device_id: int):
    dev_links = []
    for l in db["links"]:
        if l.get("coredevice_id") == device_id or l.get("neighbor_coredevice_id") == device_id:
            other_id = l.get("neighbor_coredevice_id") if l.get("coredevice_id") == device_id else l.get("coredevice_id")
            other_dev = next((d for d in db["core_devices"] if d["id"] == other_id), None)
            link_copy = dict(l)
            if other_dev:
                link_copy["neighbor_coredevice"] = {"id": other_dev["id"], "name": other_dev["name"]}
            dev_links.append(link_copy)
    return dev_links

# ==============================================================================
# SITE ROUTES (from site.py)
# ==============================================================================
router_site = APIRouter()

@router_site.get("/site/{site_id}")
async def get_site(site_id: int, current_user: dict = Depends(user_role_checker)):
    site = next((s for s in db["sites"] if s["id"] == site_id), None)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    return site

@router_site.get("/coredevice/{coredevice_id}/sites", response_model=list)
async def get_sites_of_coredevice(coredevice_id: int, current_user: dict = Depends(user_role_checker)):
    sites = [s for s in db["sites"] if coredevice_id in s["coredevice_ids"]]
    return sites

@router_site.get("/coresite/{coresite_id}/sites")
async def get_sites_of_coresite(coresite_id: int, current_user: dict = Depends(user_role_checker)):
    """Retrieves all sites associated with a core site."""
    # Find all coredevices belonging to this coresite
    coredevice_ids = [d["id"] for d in db["core_devices"] if d["coresite_id"] == coresite_id]
    # Find all sites that have any of those coredevice_ids
    sites = [s for s in db["sites"] if any(cd_id in s.get("coredevice_ids", []) for cd_id in coredevice_ids)]
    return [{"id": s["id"], "name": s["name"], "topology": s.get("topology", "{}"), "description": s.get("description", "")} for s in sites]

@router_site.get("/get_sites")
@router_site.get("/sites")
@router_site.get("/sites", response_model=List[dict])
async def get_all_sites(current_user: dict = Depends(user_role_checker)):
    return [{"id": s["id"], "name": s["name"]} for s in db["sites"]]

@router_site.post("/site/{site_id}/set-topology")
async def set_topology(site_id: int, current_user: dict = Depends(user_role_checker)):
    site = next((s for s in db["sites"] if s["id"] == site_id), None)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    # Mock topology data
    mock_topo = ([{"x": 1, "y": 2}], [{"source": 0, "target": 0}])
    site["topology"] = json.dumps(mock_topo)
    return {"message": "Topology set successfully"}

@router_site.get("/site/{site_id}/get-topology")
async def get_topology(site_id: int, current_user: dict = Depends(user_role_checker)):
    site = next((s for s in db["sites"] if s["id"] == site_id), None)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    if not site["topology"]:
        return {}
    return json.loads(site["topology"])

@router_site.put("/site/{site_id}/set-description")
async def update_site_description(site_id: int, description: SiteDescription, current_user: dict = Depends(user_role_checker)):
    site = next((s for s in db["sites"] if s["id"] == site_id), None)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    site["description"] = description.description
    return {"message": "Description updated successfully"}

@router_site.get("/site/{site_id}/get-description")
async def get_site_description(site_id: int, current_user: dict = Depends(user_role_checker)):
    site = next((s for s in db["sites"] if s["id"] == site_id), None)
    if site is None:
        raise HTTPException(status_code=404, detail="Site not found")
    return site["description"]

# ==============================================================================
# USER ROUTES (from user.py)
# ==============================================================================
router_user = APIRouter()

# Dummy token generation for mock backend
def generate_token(user_id: int) -> str:
    from jose import jwt
    # In a real app, use a strong, environment-variable-based secret key
    SECRET_KEY = "a-dummy-secret-key-for-testing"
    ALGORITHM = "HS256"
    to_encode = {"sub": str(user_id), "exp": datetime.utcnow() + timedelta(hours=1)}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@router_user.post("/login")
def login(request: LoginRequest):
    # Simplified mock authentication
    username = request.username
    # In this mock, we don't verify password to allow easy login
    user = next((u for u in db["users"] if u["username"] == username), None)
    if user:
        token = generate_token(user_id=user["id"])
        # Returning a list to match the real backend's exact format
        return [{"access_token": token, "token_type": "bearer"}, {"role": user["role"]}]
    else:
        raise HTTPException(status_code=401, detail="Incorrect username or password")

@router_user.get("/users/")
async def get_all_users(current_user: dict = Depends(admin_role_checker)):
    return [{"id": u["id"], "username": u["username"], "role": u["role"]} for u in db["users"]]

@router_user.put("/users/{user_id}/make-admin")
async def make_user_admin(user_id: int, current_user: dict = Depends(admin_role_checker)):
    user = next((u for u in db["users"] if u["id"] == user_id), None)
    if user:
        user["role"] = "admin"
        return {"message": f"User {user['username']} is now an admin"}
    else:
        raise HTTPException(status_code=404, detail="User not found")

# ==============================================================================
# STATE ROUTES (interface-states, ospf-states, mpls-states)
# ==============================================================================
router_states = APIRouter()

@router_states.get("/interface-states")
async def get_interface_states(current_user: dict = Depends(user_role_checker)):
    """Returns interface states."""
    interface_states = {}
    for link in db["links"]:
        device = next((d for d in db["core_devices"] if d["id"] == link["coredevice_id"]), None)
        if device:
            key = f"{device['name']}_GigabitEthernet0/{link['id'] % 4}"
            interface_states[key] = {
                "status": link.get("physical_status", "Up"),
                "protocol": link.get("protocol_status", "Up"),
                "bandwidth": link.get("bw", "10G"),
                "input_rate": link.get("input_rate", "0"),
                "output_rate": link.get("output_rate", "0"),
            }
    return {"interface_states": interface_states}

@router_states.get("/ospf-states")
async def get_ospf_states(current_user: dict = Depends(user_role_checker)):
    """Returns OSPF states."""
    ospf_states = {}
    for link in db["links"]:
        if link.get("neighbor_is_core"):
            device = next((d for d in db["core_devices"] if d["id"] == link["coredevice_id"]), None)
            if device:
                key = f"{device['name']}_ospf_{link['id']}"
                ospf_states[key] = {
                    "state": "Full",
                    "neighbor_id": link.get("neighbor_ip", ""),
                    "area": "0.0.0.0",
                    "interface": f"GigabitEthernet0/{link['id'] % 4}",
                }
    return {"ospf_states": ospf_states}

@router_states.get("/mpls-states")
async def get_mpls_states(current_user: dict = Depends(user_role_checker)):
    """Returns MPLS states."""
    mpls_states = {}
    for link in db["links"]:
        if link.get("mpls_ldp") == "Enabled":
            device = next((d for d in db["core_devices"] if d["id"] == link["coredevice_id"]), None)
            if device:
                key = f"{device['name']}_mpls_{link['id']}"
                mpls_states[key] = {
                    "ldp_status": "Enabled",
                    "neighbor_ip": link.get("neighbor_ip", ""),
                    "interface": f"GigabitEthernet0/{link['id'] % 4}",
                    "label_range": "16-100000",
                }
    return {"mpls_states": mpls_states}


# --- Include all routers in the main FastAPI app ---
app.include_router(router_alerts, tags=["Alerts"])
app.include_router(router_coredevice, tags=["Core Devices"])
app.include_router(router_coresite, tags=["Core Sites"])
app.include_router(router_network, tags=["Networks"])
app.include_router(router_link, tags=["Links"])
app.include_router(router_site, tags=["Sites"])
app.include_router(router_user, tags=["Users"])
app.include_router(router_states, tags=["States"])


# --- Root endpoint for health check ---
@app.get("/")
def read_root():
    return {"message": "Welcome to the Spiderweb Dummy Backend"}

# To run this app:
# 1. Save this file as main.py
# 2. Make sure you have `requirements.txt` in the same directory
# 3. Run `pip install -r requirements.txt`
# 4. Run `uvicorn main:app --reload`
