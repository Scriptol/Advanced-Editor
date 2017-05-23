function Eratosthenes(element, top)
{
  var all = new Uint8Array(new ArrayBuffer(top));
  var idx = 0;
  var prime = 3;
  var x, j;

  element.innerHTML = "1 ";

  while(prime <= top)   {
    var flag = true;
    for(x = 0; x < top; x++) {
        if(all[x] == prime)  {
            flag = false;
            break;
        }
    }
    if(flag)  {
        element.innerHTML += prime + " ";
        j = prime;
        while(j <= (top / prime))  {
            all[idx++] = prime * j;
            j += 1;
        }
    }
    prime += 2;
  }
  element.innerHTML += "<br>";
  return;
}


