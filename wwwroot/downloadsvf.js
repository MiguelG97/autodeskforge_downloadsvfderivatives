fetch("/bubble")
  .then((res) => {
    console.log(res);
    if (res.ok) {
      alert("svf files downloaded!");
    } else {
      alert("sth went wrong");
    }
  })
  .catch((err) => {
    console.log(err);
  });
//   if (response.ok) {
//     alert("svf files downloaded!");
//   } else {
//     alert("... wtf?");
//   }
