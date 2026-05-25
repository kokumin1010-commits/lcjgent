import mysql.connector
conn = mysql.connector.connect(
    host='gateway03.us-east-1.prod.aws.tidbcloud.com',
    port=4000,
    user='ViCMbGRGvoSuVwV.root',
    password='yee376welv03EMyc1Vku',
    database='GgA9WvTBCZMf6mjyMMwACw',
    ssl_disabled=False,
    ssl_verify_cert=False,
    use_pure=True
)
cur = conn.cursor()

# Find yae's liver ID
cur.execute("SELECT id, name FROM livers WHERE name LIKE '%yae%'")
livers = cur.fetchall()
print('=== yae liver info ===')
for l in livers:
    print(f'  id={l[0]}, name={l[1]}')

if livers:
    liver_id = livers[0][0]
    
    # Check schedules for yae in May 2026
    cur.execute(f"""
        SELECT id, startTime, endTime, title, category, status, liverId, liverName
        FROM schedules 
        WHERE liverId = {liver_id} 
        AND startTime >= '2026-05-01' AND startTime <= '2026-05-31'
        AND category = 'live'
        AND status != 'cancelled'
        ORDER BY startTime DESC
        LIMIT 20
    """)
    schedules = cur.fetchall()
    print(f'\n=== yae schedules in May 2026 (live, not cancelled): {len(schedules)} ===')
    for s in schedules:
        print(f'  id={s[0]}, start={s[1]}, end={s[2]}, title={s[3]}, cat={s[4]}, status={s[5]}, liverId={s[6]}, liverName={s[7]}')
    
    # Check livestreams for yae in May 2026
    cur.execute(f"""
        SELECT id, livestreamDate, scheduleId, createdAt, duration
        FROM brand_livestreams 
        WHERE liverId = {liver_id} 
        AND livestreamDate >= '2026-05-01' AND livestreamDate <= '2026-05-31'
        AND deletedAt IS NULL
        ORDER BY livestreamDate DESC
        LIMIT 20
    """)
    streams = cur.fetchall()
    print(f'\n=== yae livestreams in May 2026: {len(streams)} ===')
    for s in streams:
        print(f'  id={s[0]}, date={s[1]}, scheduleId={s[2]}, createdAt={s[3]}, duration={s[4]}')

    # Now simulate the compliance logic: group schedules by date
    print('\n=== Schedule dates (JST) ===')
    schedule_dates = {}
    for s in schedules:
        if s[1]:
            from datetime import timedelta
            # startTime is already in some timezone, let's see raw value
            raw = s[1]
            print(f'  raw startTime: {raw} (type: {type(raw)})')
            # If it's a datetime, convert to JST
            if hasattr(raw, 'hour'):
                jst = raw + timedelta(hours=9)
                date_key = jst.strftime('%Y-%m-%d')
            else:
                date_key = str(raw)[:10]
            schedule_dates[date_key] = schedule_dates.get(date_key, 0) + 1
    print(f'  Schedule dates map: {schedule_dates}')
    
    # Group livestreams by date
    print('\n=== Livestream dates (JST) ===')
    livestream_dates = {}
    for s in streams:
        if s[1]:
            raw = s[1]
            print(f'  raw livestreamDate: {raw} (type: {type(raw)})')
            if hasattr(raw, 'hour'):
                jst = raw + timedelta(hours=9)
                date_key = jst.strftime('%Y-%m-%d')
            else:
                date_key = str(raw)[:10]
            livestream_dates[date_key] = livestream_dates.get(date_key, 0) + 1
    print(f'  Livestream dates map: {livestream_dates}')
    
    # Compare
    print('\n=== Comparison ===')
    all_dates = set(list(livestream_dates.keys()) + list(schedule_dates.keys()))
    for d in sorted(all_dates):
        sch_count = schedule_dates.get(d, 0)
        ls_count = livestream_dates.get(d, 0)
        status = 'OK' if sch_count >= ls_count else f'UNSCHEDULED ({ls_count - sch_count})'
        print(f'  {d}: schedules={sch_count}, livestreams={ls_count} -> {status}')

cur.close()
conn.close()
