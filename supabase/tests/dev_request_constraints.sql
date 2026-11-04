-- Tests of migration 0012 (dev_request). One DO block, ends with a rollback
-- exception: "TESTS OK: …" shown as an error is the success result.
do $outer$
declare n int := 0;
begin
  begin
    insert into dev_request (reference, kind, title, description) values ('DEV-T1', 'WISH', 'Dark mode', 'Please add a dark mode to the backoffice');
    raise exception 'FAIL - unknown kind accepted';
  exception when check_violation then n := n + 1; end;
  begin
    insert into dev_request (reference, kind, title, description) values ('DEV-T2', 'FEATURE', 'x', 'Please add a dark mode to the backoffice');
    raise exception 'FAIL - short title accepted';
  exception when check_violation then n := n + 1; end;
  begin
    insert into dev_request (reference, kind, title, description) values ('DEV-T3', 'FEATURE', 'Dark mode', 'short');
    raise exception 'FAIL - short description accepted';
  exception when check_violation then n := n + 1; end;
  begin
    insert into dev_request (reference, kind, title, description, priority) values ('DEV-T4', 'FEATURE', 'Dark mode', 'Please add a dark mode to the backoffice', 'URGENT');
    raise exception 'FAIL - unknown priority accepted';
  exception when check_violation then n := n + 1; end;

  insert into dev_request (reference, kind, title, description) values ('DEV-OK', 'FEATURE', 'Export CSV', 'Add a CSV export of the companies list');
  if (select status from dev_request where reference = 'DEV-OK') <> 'NEW' then
    raise exception 'FAIL - a request should start NEW';
  end if;
  begin
    update dev_request set status = 'DECLINED' where reference = 'DEV-OK';
    raise exception 'FAIL - declined without a comment';
  exception when check_violation then n := n + 1; end;
  begin
    insert into dev_request (reference, kind, title, description) values ('DEV-OK', 'BUG', 'Duplicate', 'Same reference as the previous one');
    raise exception 'FAIL - duplicate reference accepted';
  exception when unique_violation then n := n + 1; end;
  update dev_request set status = 'IN_PROGRESS' where reference = 'DEV-OK';
  update dev_request set status = 'DECLINED', dev_comment = 'Out of scope for now' where reference = 'DEV-OK';

  insert into support_tickets (type, reference, subject, message, requester_name, requester_email, requester_phone, is_visitor)
  values ('contact', 'SUP-T1', 'Question', 'A visitor without account asks something', 'Jane Visitor', 'jane@example.com', '+971 50 000 0000', true);
  if not (select is_visitor from support_tickets where reference = 'SUP-T1') then
    raise exception 'FAIL - visitor flag lost';
  end if;

  raise exception 'TESTS OK: % negative checks passed, plus the happy path (everything rolled back)', n;
end
$outer$;
