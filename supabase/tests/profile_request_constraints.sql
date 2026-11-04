-- Run after migration 0008. One statement, always ends with an exception that
-- rolls everything back: "TESTS OK" is the success message.
do $t$
declare u1 uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); rid uuid;
begin
  insert into profile_change_request(reference,user_id,requested_values)
    values ('T1',u1,'{"holder_status":"MANAGER"}') returning id into rid;

  -- each of these must be refused
  begin insert into profile_change_request(reference,user_id,requested_values) values ('T2',u1,'{"last_name":"B"}');
    raise exception 'second open request accepted'; exception when unique_violation then null; end;
  begin insert into profile_change_request(reference,user_id,requested_values) values ('T3',u2,'{"holder_status":"BOSS"}');
    raise exception 'bad status accepted'; exception when check_violation then null; end;
  begin insert into profile_change_request(reference,user_id,requested_values) values ('T4',u2,'{"email":"x"}');
    raise exception 'bad email accepted'; exception when check_violation then null; end;
  begin insert into profile_change_request(reference,user_id,requested_values) values ('T5',u2,'{"role":"admin"}');
    raise exception 'unknown field accepted'; exception when check_violation then null; end;
  begin update profile_change_request set status='refuse', decided_at=now() where id=rid;
    raise exception 'refusal without comment accepted'; exception when check_violation then null; end;

  update profile_change_request set status='approuve', decided_at=now() where id=rid;
  begin update profile_change_request set status='refuse', decided_at=now(), decision_comment='non' where id=rid;
    raise exception 'decided request re-decided'; exception when check_violation then null; end;
  -- a new request is possible once the previous one is decided
  insert into profile_change_request(reference,user_id,requested_values) values ('T6',u1,'{"last_name":"B"}');
  raise exception 'TESTS OK: profile_request_constraints passed (everything rolled back)';
end $t$;
